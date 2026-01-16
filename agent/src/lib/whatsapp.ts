/**
 * WhatsApp Client for Agent
 * 
 * This module provides WhatsApp integration for the AI agent.
 * Uses a simpler configuration that works across environments.
 */

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { EventEmitter } from "events";
import QRCode from "qrcode";

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
  };
  private messageQueue: Array<{ to: string; message: string; retries: number }> = [];
  private isProcessing = false;

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
   * Initialize WhatsApp client (call this during agent startup)
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.client) {
        return this.state.status === "ready";
      }

      this.state.status = "connecting";
      this.emit("status", this.state);

      // Simple puppeteer config with Linux server support
      const puppeteerConfig: {
        headless: boolean;
        args: string[];
        executablePath?: string;
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
      };

      // Use system Chromium on Linux servers (like Render)
      if (process.platform === 'linux') {
        puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
      }

      this.client = new Client({
        puppeteer: puppeteerConfig,
        authStrategy: new LocalAuth({
          clientId: "agent-whatsapp",
        }),
      });

      // Generate QR code for first-time connection
      this.client.on("qr", (qr: string) => {
        console.log("📱 Scan this QR code with your WhatsApp:");
        this.emit("qr", qr);

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
        } else {
          // In production, generate a Data URL and log it
          QRCode.toDataURL(qr, (err: Error | null | undefined, url: string) => {
            if (err) {
              console.error("Error generating QR code URL:", err);
              return;
            }
            console.log("QR code (open this URL in your browser to scan):");
            console.log("```");
            console.log(url);
            console.log("```");
          });
        }
      });

      // Setup event handlers
      this.client.on("ready", () => {
        this.state.status = "ready";
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

      this.client.on("message", (msg: any) => {
        this.emit("message", msg);
      });

      this.client.on("message_create", (msg: any) => {
        this.emit("message_create", msg);
      });

      // Initialize the client
      this.client.initialize();

      return true;
    } catch (error) {
      this.state.status = "error";
      this.state.lastError = error instanceof Error ? error.message : "Unknown error";
      this.emit("status", this.state);
      console.error("Failed to initialize WhatsApp client:", error);
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
      await this.client.destroy();
      this.client = null;
    }

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
