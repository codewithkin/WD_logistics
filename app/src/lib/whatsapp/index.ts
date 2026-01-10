/**
 * WhatsApp Web.js Client
 * 
 * This module provides WhatsApp messaging functionality using whatsapp-web.js.
 * It handles client initialization, authentication via QR code, and message sending.
 * 
 * Note: wweb-js requires a Chromium browser to run. In production, use puppeteer
 * with a proper headless configuration.
 */

import { Client, LocalAuth, Message } from "whatsapp-web.js";
import { EventEmitter } from "events";

export type WhatsAppStatus = 
  | "disconnected" 
  | "connecting" 
  | "qr_ready" 
  | "authenticated" 
  | "ready" 
  | "auth_failure";

export interface WhatsAppState {
  status: WhatsAppStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  lastError: string | null;
}

class WhatsAppService extends EventEmitter {
  private client: Client | null = null;
  private state: WhatsAppState = {
    status: "disconnected",
    qrCode: null,
    phoneNumber: null,
    lastError: null,
  };

  constructor() {
    super();
  }

  /**
   * Get current state
   */
  getState(): WhatsAppState {
    return { ...this.state };
  }

  /**
   * Initialize WhatsApp client
   */
  async initialize(): Promise<void> {
    if (this.client) {
      console.log("WhatsApp client already initialized");
      return;
    }

    this.updateState({ status: "connecting", lastError: null });

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: ".wwebjs_auth",
        }),
        puppeteer: {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu",
          ],
        },
      });

      // QR Code received
      this.client.on("qr", (qr) => {
        console.log("WhatsApp QR Code received");
        this.updateState({ status: "qr_ready", qrCode: qr });
        this.emit("qr", qr);
      });

      // Authentication successful
      this.client.on("authenticated", () => {
        console.log("WhatsApp authenticated");
        this.updateState({ status: "authenticated", qrCode: null });
        this.emit("authenticated");
      });

      // Auth failure
      this.client.on("auth_failure", (error) => {
        console.error("WhatsApp auth failure:", error);
        this.updateState({ 
          status: "auth_failure", 
          lastError: error.message || "Authentication failed" 
        });
        this.emit("auth_failure", error);
      });

      // Client ready
      this.client.on("ready", async () => {
        console.log("WhatsApp client ready");
        const info = this.client?.info;
        this.updateState({ 
          status: "ready", 
          phoneNumber: info?.wid?.user || null 
        });
        this.emit("ready");
      });

      // Disconnected
      this.client.on("disconnected", (reason) => {
        console.log("WhatsApp disconnected:", reason);
        this.updateState({ 
          status: "disconnected", 
          phoneNumber: null,
          lastError: reason 
        });
        this.client = null;
        this.emit("disconnected", reason);
      });

      // Message received
      this.client.on("message", (message: Message) => {
        this.emit("message", message);
      });

      // Initialize
      await this.client.initialize();
    } catch (error) {
      console.error("WhatsApp initialization error:", error);
      this.updateState({ 
        status: "disconnected", 
        lastError: error instanceof Error ? error.message : "Initialization failed" 
      });
      this.client = null;
      throw error;
    }
  }

  /**
   * Disconnect WhatsApp client
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.updateState({ 
        status: "disconnected", 
        qrCode: null, 
        phoneNumber: null 
      });
    }
  }

  /**
   * Send a message
   * @param phoneNumber - Phone number in format: countrycode + number (e.g., "1234567890")
   * @param message - Message text
   */
  async sendMessage(phoneNumber: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client || this.state.status !== "ready") {
      return { 
        success: false, 
        error: "WhatsApp client not ready" 
      };
    }

    try {
      // Format number for WhatsApp (add @c.us suffix)
      const formattedNumber = phoneNumber.replace(/\D/g, "") + "@c.us";
      
      // Check if number is registered
      const isRegistered = await this.client.isRegisteredUser(formattedNumber);
      if (!isRegistered) {
        return { 
          success: false, 
          error: "Phone number not registered on WhatsApp" 
        };
      }

      // Send message
      const sentMessage = await this.client.sendMessage(formattedNumber, message);
      
      return { 
        success: true, 
        messageId: sentMessage.id.id 
      };
    } catch (error) {
      console.error("WhatsApp send message error:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to send message" 
      };
    }
  }

  /**
   * Check if a number is registered on WhatsApp
   */
  async isRegistered(phoneNumber: string): Promise<boolean> {
    if (!this.client || this.state.status !== "ready") {
      return false;
    }

    try {
      const formattedNumber = phoneNumber.replace(/\D/g, "") + "@c.us";
      return await this.client.isRegisteredUser(formattedNumber);
    } catch {
      return false;
    }
  }

  /**
   * Update internal state
   */
  private updateState(update: Partial<WhatsAppState>): void {
    this.state = { ...this.state, ...update };
    this.emit("state_change", this.state);
  }
}

// Singleton instance
let whatsappService: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService {
  if (!whatsappService) {
    whatsappService = new WhatsAppService();
  }
  return whatsappService;
}

export default getWhatsAppService;
