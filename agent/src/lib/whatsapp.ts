/**
 * WhatsApp Client for Agent
 * 
 * This module provides WhatsApp integration for the AI agent.
 * It reuses the shared WhatsApp service from the Next.js app.
 */

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { EventEmitter } from "events";
import * as qrcode from "qrcode-terminal";

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

      // Configure Puppeteer args based on environment
      const puppeteerConfig: any = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      };

      // In Docker/production, use system Chromium
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: "agent-whatsapp",
        }),
        puppeteer: puppeteerConfig,
      });

      this.client.on("qr", (qr: string) => {
        this.emit("qr", qr);
        console.log("WhatsApp QR Code received. Scan to authenticate.");
        // Optional: Display QR code in terminal
        qrcode.generate(qr, { small: true });
      });

      // Setup event handlers
      this.client.on("ready", () => {
        this.state.status = "ready";
        const info = this.client?.info;
        if (info) {
          this.state.phoneNumber = info.wid.user;
        }
        this.emit("status", this.state);
        console.log("✅ Agent WhatsApp Client ready");

        // Process queued messages
        this.processMessageQueue();
      });

      this.client.on("disconnected", () => {
        this.state.status = "disconnected";
        this.state.phoneNumber = null;
        this.emit("status", this.state);
        console.log("❌ Agent WhatsApp Client disconnected");
      });

      this.client.on("auth_failure", (msg: any) => {
        this.state.status = "error";
        this.state.lastError = msg || "Authentication failed";
        this.emit("status", this.state);
        console.error("❌ Agent WhatsApp Auth Failed:", msg);
      });

      this.client.on("message", (msg: any) => {
        this.emit("message", msg);
      });

      // Initialize the client
      await this.client.initialize();

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

    // If doesn't start with +, prepend +1 (US default)
    if (!cleaned.startsWith("+")) {
      cleaned = `+1${cleaned}`;
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
