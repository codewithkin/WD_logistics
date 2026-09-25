/**
 * WhatsApp Client for Agent
 * 
 * This module provides WhatsApp integration for the AI agent.
 * Uses a simpler configuration that works across environments.
 */

import pkg from "whatsapp-web.js";
const { Client, LocalAuth, RemoteAuth } = pkg;
import { EventEmitter } from "events";
import QRCode from "qrcode";
import path from "path";
import { acquireSessionLock, type SessionLock } from "./whatsapp-session";
import { PostgresSessionStore } from "./wa-session-store";

// Where the WhatsApp session (LocalAuth) is stored. Defaults to an absolute
// path under the process working directory so the auth state survives
// container restarts/rebuilds as long as this directory is mounted as a
// volume (see Dockerfile + docker-compose.yml). Override via
// WHATSAPP_AUTH_PATH to point at the volume explicitly if the CWD differs.
const WHATSAPP_AUTH_PATH = process.env.WHATSAPP_AUTH_PATH || path.resolve(process.cwd(), ".wwebjs_auth");

/** One name for the stored session, so a redeploy finds what the last one saved. */
const SESSION_NAME = "agent-whatsapp";

/**
 * How often the session is copied to Postgres. The library refuses anything
 * under a minute, and more often than that buys nothing: the session only
 * changes materially when WhatsApp rotates keys.
 */
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;

let sessionStore: PostgresSessionStore | null = null;

/**
 * Where the pairing is kept.
 *
 * With DATABASE_URL set, the session lives in Postgres and survives redeploys,
 * rebuilds and the container filesystem being thrown away — which is what was
 * happening: LocalAuth keeps the pairing inside a Chromium profile directory,
 * so every deploy demanded a fresh QR scan.
 *
 * Without it, LocalAuth is used exactly as before. That keeps a laptop
 * working with no database, and it is a fallback rather than the default
 * because on a hosted deploy it will lose the session.
 */
function buildAuthStrategy() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn(
      "⚠️  [whatsapp] DATABASE_URL is not set, so the session is being kept on " +
        "disk. It will be lost on the next redeploy and the QR code will have " +
        "to be scanned again.",
    );
    return new LocalAuth({
      clientId: SESSION_NAME,
      dataPath: WHATSAPP_AUTH_PATH,
    });
  }

  // The store is given the same dataPath as RemoteAuth below: that is where
  // the library writes the archive it then asks the store to save.
  sessionStore =
    sessionStore ?? new PostgresSessionStore(connectionString, WHATSAPP_AUTH_PATH);
  console.log("🗄️  [whatsapp] session stored in Postgres; survives redeploys");

  return new RemoteAuth({
    clientId: SESSION_NAME,
    dataPath: WHATSAPP_AUTH_PATH,
    store: sessionStore,
    backupSyncIntervalMs: BACKUP_INTERVAL_MS,
  });
}

/** When the session was last copied to Postgres, for the status endpoint. */
export async function sessionLastSavedAt(): Promise<Date | null> {
  if (!sessionStore) return null;
  try {
    return await sessionStore.lastSavedAt(SESSION_NAME);
  } catch {
    return null;
  }
}

export interface WhatsAppMessage {
  id: string;
  to: string;
  body: string;
  timestamp: Date;
  status: "sent" | "delivered" | "read" | "failed";
  error?: string;
}

export type AgentWhatsAppStatus = "disconnected" | "connecting" | "ready" | "error";

export interface AgentWhatsAppState {
  status: AgentWhatsAppStatus;
  phoneNumber: string | null;
  messagesSent: number;
  lastError: string | null;
  qrCode: string | null;
}

/**
 * WhatsApp client for the AI agent to send messages
 */
export class AgentWhatsAppClient extends EventEmitter {
  private client: any = null;
  private state: AgentWhatsAppState = {
    status: "disconnected",
    phoneNumber: null,
    messagesSent: 0,
    lastError: null,
    qrCode: null,
  };
  private messageQueue: Array<{ to: string; message: string; retries: number }> = [];
  private isProcessing = false;
  /** Held for as long as this process owns the Chromium profile. */
  private sessionLock: SessionLock | null = null;

  constructor() {
    super();
  }

  /**
   * Get current state
   */
  getState(): AgentWhatsAppState {
    return { ...this.state };
  }

  /**
   * Record that the browser died under us.
   *
   * Called by the crash guard, which survives the Puppeteer errors that used
   * to end the process. Without this the client would go on reporting
   * "ready" to /whatsapp/status and to the Settings page long after the page
   * backing it had gone — the one thing worse than being disconnected is not
   * knowing you are.
   */
  markBrowserLost(): void {
    if (this.state.status === "disconnected") return;
    this.state.status = "disconnected";
    this.state.phoneNumber = null;
    this.emit("status", this.state);
  }

  /**
   * Initialize WhatsApp client (call this during agent startup)
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.client) {
        return this.state.status === "ready";
      }

      // Claim the Chromium profile before launching anything. Two clients on
      // one profile is what makes a freshly scanned session drop moments
      // later, and it is far better to refuse to start than to corrupt it.
      try {
        this.sessionLock = acquireSessionLock(WHATSAPP_AUTH_PATH);
      } catch (lockError) {
        this.state.status = "error";
        this.state.lastError =
          lockError instanceof Error ? lockError.message : "Session already in use";
        this.emit("status", this.state);
        console.error(`❌ ${this.state.lastError}`);
        return false;
      }

      this.state.status = "connecting";
      this.emit("status", this.state);

      // Simple puppeteer config with Linux server support
      const puppeteerConfig: {
        headless: boolean;
        args: string[];
        executablePath?: string;
        protocolTimeout?: number;
      } = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
        // Puppeteer's default (180s) was still timing out ("Runtime.callFunctionOn
        // timed out") under CPU/memory pressure on small VPS deployments — this
        // doesn't fix resource contention, it just stops the connection from
        // being torn down over a slow-but-alive Chromium process.
        protocolTimeout: 300000,
      };

      // Use system Chromium on Linux servers (like Render)
      if (process.platform === 'linux') {
        puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
      }

      this.client = new Client({
        puppeteer: puppeteerConfig,
        authStrategy: buildAuthStrategy(),
      });

      // Generate QR code for first-time connection
      this.client.on("qr", (qr: string) => {
        console.log("📱 Scan this QR code with your WhatsApp:");
        this.emit("qr", qr);

        // Generate QR code as Data URL and store it
        QRCode.toDataURL(qr, (err: Error | null | undefined, url: string) => {
          if (err) {
            console.error("Error generating QR code URL:", err);
            return;
          }
          this.state.qrCode = url;
          this.emit("qr_data_url", url);
          console.log("QR code generated and stored for web display");
        });

        if (process.env.NODE_ENV === "development") {
          // Render QR in terminal (works locally)
          QRCode.toString(qr, { type: "terminal", small: true }, (err: Error | null | undefined, qrCode: string) => {
            if (err) {
              console.error("Error generating terminal QR code:", err);
              return;
            }
            console.log("```");
            console.log(qrCode);
            console.log("```");
          });
        }
      });

      // Setup event handlers
      this.client.on("ready", () => {
        this.state.status = "ready";
        this.state.qrCode = null; // Clear QR code once connected
        const info = this.client?.info;
        if (info) {
          this.state.phoneNumber = info.wid.user;
        }
        this.emit("status", this.state);
        console.log("✅ WhatsApp client is ready!");

        // Process queued messages
        this.processMessageQueue();
      });

      this.client.on("disconnected", () => {
        this.state.status = "disconnected";
        this.state.phoneNumber = null;
        this.emit("status", this.state);
        console.log("❌ WhatsApp client disconnected");
      });

      this.client.on("auth_failure", (msg: any) => {
        this.state.status = "error";
        this.state.lastError = msg || "Authentication failed";
        this.emit("status", this.state);
        console.error("❌ WhatsApp Auth Failed:", msg);
      });

      // Delivery receipts. whatsapp-web.js raises message_ack when a message
      // reaches the recipient's device (ack 2) and again when they open it
      // (ack 3). Without this the app could say "sent" and nothing more,
      // which is most of what item 5 was about.
      this.client.on("message_ack", (msg: any, ack: number) => {
        this.emit("message_ack", { messageId: msg?.id?._serialized, ack });
      });

      // Only listen to message_create for outgoing and incoming messages
      // (message event is for incoming only, message_create is for all messages)
      this.client.on("message_create", (msg: any) => {
        this.emit("message_create", msg);
      });

      // Initialize the client with retry logic
      let initAttempts = 0;
      const maxAttempts = 3;
      
      while (initAttempts < maxAttempts) {
        try {
          initAttempts++;
          console.log(`🔄 Initializing WhatsApp client (attempt ${initAttempts}/${maxAttempts})...`);
          await this.client.initialize();
          console.log("✅ WhatsApp client initialization completed");
          return true;
        } catch (initError) {
          console.error(`❌ Initialization attempt ${initAttempts} failed:`, initError);
          
          if (initAttempts >= maxAttempts) {
            throw initError;
          }
          
          // Wait before retry with exponential backoff
          const waitTime = Math.min(1000 * Math.pow(2, initAttempts - 1), 5000);
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Destroy and recreate client for fresh attempt
          try {
            await this.client.destroy();
          } catch (e) {
            // Ignore destroy errors
          }
          
          this.client = new Client({
            puppeteer: puppeteerConfig,
            authStrategy: buildAuthStrategy(),
          });
          
          // Re-attach event handlers
          this.client.on("qr", (qr: string) => {
            console.log("📱 Scan this QR code with your WhatsApp:");
            this.emit("qr", qr);
            QRCode.toDataURL(qr, (err: Error | null | undefined, url: string) => {
              if (!err) {
                this.state.qrCode = url;
                this.emit("qr_data_url", url);
              }
            });
          });
          
          this.client.on("ready", () => {
            this.state.status = "ready";
            this.state.qrCode = null;
            const info = this.client?.info;
            if (info) {
              this.state.phoneNumber = info.wid.user;
            }
            this.emit("status", this.state);
            console.log("✅ WhatsApp client is ready!");
            this.processMessageQueue();
          });
          
          this.client.on("disconnected", () => {
            this.state.status = "disconnected";
            this.state.phoneNumber = null;
            this.emit("status", this.state);
            console.log("❌ WhatsApp client disconnected");
          });
          
          this.client.on("auth_failure", (msg: any) => {
            this.state.status = "error";
            this.state.lastError = msg || "Authentication failed";
            this.emit("status", this.state);
            console.error("❌ WhatsApp Auth Failed:", msg);
          });
          
          // Only listen to message_create to avoid duplicate handling
          this.client.on("message_create", (msg: any) => {
            this.emit("message_create", msg);
          });
        }
      }
      
      return true;
    } catch (error) {
      this.state.status = "error";
      this.state.lastError = error instanceof Error ? error.message : "Unknown error";
      this.emit("status", this.state);
      console.error("Failed to initialize WhatsApp client after all attempts:", error);
      return false;
    }
  }

  /**
   * Send message via WhatsApp
   */
  async sendMessage(phoneNumber: string, message: string): Promise<WhatsAppMessage> {
    if (this.state.status !== "ready") {
      throw new Error(
        `WhatsApp client is not ready (status: ${this.state.status}). Queue message and retry.`
      );
    }

    if (!this.client) {
      throw new Error("WhatsApp client not initialized");
    }

    try {
      // Format phone number
      const formattedNumber = this.formatPhoneNumber(phoneNumber);

      // Check if number is registered
      const isRegistered = await this.client.isRegisteredUser(formattedNumber);
      if (!isRegistered) {
        throw new Error(`Phone number ${phoneNumber} is not registered on WhatsApp`);
      }

      // Send message
      const result = await this.client.sendMessage(formattedNumber, message);

      this.state.messagesSent++;

      return {
        id: result.id.id,
        to: phoneNumber,
        body: message,
        timestamp: new Date(),
        status: "sent",
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.state.lastError = errorMsg;

      // Queue for retry if connection issue
      if (this.state.status === "ready") {
        this.queueMessage(phoneNumber, message);
      }

      throw new Error(`Failed to send message: ${errorMsg}`);
    }
  }

  /**
   * Send bulk messages (respects rate limiting)
   */
  async sendBulkMessages(
    messages: Array<{ to: string; body: string }>,
    delayMs: number = 1000
  ): Promise<Array<WhatsAppMessage | { to: string; error: string }>> {
    const results: Array<WhatsAppMessage | { to: string; error: string }> = [];

    for (const msg of messages) {
      try {
        const result = await this.sendMessage(msg.to, msg.body);
        results.push(result);

        // Respect rate limiting
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        results.push({
          to: msg.to,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Queue message for retry
   */
  private queueMessage(to: string, message: string) {
    this.messageQueue.push({
      to,
      message,
      retries: 0,
    });
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const maxRetries = 3;

    while (this.messageQueue.length > 0 && this.state.status === "ready") {
      const item = this.messageQueue.shift();
      if (!item) break;

      try {
        await this.sendMessage(item.to, item.message);
      } catch (error) {
        item.retries++;
        if (item.retries < maxRetries) {
          // Re-queue for retry
          this.messageQueue.push(item);
        } else {
          console.error(`Failed to send message after ${maxRetries} retries:`, error);
        }
      }

      // Delay between messages
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    this.isProcessing = false;
  }

  /**
   * Format phone number to WhatsApp format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, "");

    // Remove + if present
    if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }

    return `${cleaned}@c.us`;
  }

  /**
   * Disconnect client
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      // destroy() closes Chromium and waits for it, which is what actually
      // flushes the session to disk. Skipping it — as an unhandled SIGINT
      // does — is how a scanned session comes back unauthenticated.
      await this.client.destroy();
      this.client = null;
    }

    this.sessionLock?.release();
    this.sessionLock = null;

    this.state.status = "disconnected";
    this.state.phoneNumber = null;
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.state.status === "ready";
  }

  /**
   * Get message queue length
   */
  getQueueLength(): number {
    return this.messageQueue.length;
  }

  /**
   * Get underlying WhatsApp client instance
   */
  getClient(): any {
    return this.client;
  }
}

// Global singleton
let agentWhatsAppClient: AgentWhatsAppClient;

export function getAgentWhatsAppClient(): AgentWhatsAppClient {
  if (!agentWhatsAppClient) {
    agentWhatsAppClient = new AgentWhatsAppClient();
  }
  return agentWhatsAppClient;
}
