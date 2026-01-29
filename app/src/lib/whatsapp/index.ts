/**
 * WhatsApp Web.js Integration
 * 
 * This module provides WhatsApp messaging functionality using whatsapp-web.js.
 * The client is singleton and persists across requests.
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'qr' | 'ready' | 'error';

interface WhatsAppState {
  client: InstanceType<typeof Client> | null;
  status: WhatsAppStatus;
  qrCode: string | null;
  error: string | null;
  organizationId: string | null;
}

// Global state for WhatsApp client
const state: WhatsAppState = {
  client: null,
  status: 'disconnected',
  qrCode: null,
  error: null,
  organizationId: null,
};

/**
 * Get the current WhatsApp status
 */
export function getWhatsAppStatus() {
  return {
    status: state.status,
    qrCode: state.qrCode,
    error: state.error,
    organizationId: state.organizationId,
  };
}

/**
 * Initialize WhatsApp client for an organization
 */
export async function initializeWhatsApp(organizationId: string): Promise<{
  success: boolean;
  message: string;
  qrCode?: string;
}> {
  // If already initialized for this org and ready, return success
  if (state.client && state.status === 'ready' && state.organizationId === organizationId) {
    return { success: true, message: 'WhatsApp already connected' };
  }

  // If connecting, return current state
  if (state.status === 'connecting' || state.status === 'qr') {
    return {
      success: true,
      message: 'WhatsApp is connecting',
      qrCode: state.qrCode || undefined,
    };
  }

  // Destroy existing client if switching orgs
  if (state.client && state.organizationId !== organizationId) {
    await state.client.destroy();
    state.client = null;
  }

  state.organizationId = organizationId;
  state.status = 'connecting';
  state.error = null;
  state.qrCode = null;

  try {
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: `org-${organizationId}`,
        dataPath: './.wwebjs_auth',
      }),
      puppeteer: {
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
      },
    });

    client.on('qr', (qr) => {
      console.log('📱 WhatsApp QR Code received');
      qrcode.generate(qr, { small: true });
      state.status = 'qr';
      state.qrCode = qr;
    });

    client.on('ready', () => {
      console.log('✅ WhatsApp client is ready');
      state.status = 'ready';
      state.qrCode = null;
    });

    client.on('authenticated', () => {
      console.log('🔐 WhatsApp authenticated');
    });

    client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      state.status = 'error';
      state.error = `Authentication failed: ${msg}`;
    });

    client.on('disconnected', (reason) => {
      console.log('📴 WhatsApp disconnected:', reason);
      state.status = 'disconnected';
      state.client = null;
    });

    state.client = client;
    await client.initialize();

    return {
      success: true,
      message: 'WhatsApp initialization started',
      qrCode: state.qrCode || undefined,
    };
  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp:', error);
    state.status = 'error';
    state.error = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: state.error,
    };
  }
}

/**
 * Send a WhatsApp message
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  if (!state.client || state.status !== 'ready') {
    return {
      success: false,
      message: 'WhatsApp client is not ready',
    };
  }

  try {
    // Format phone number (remove + and add @c.us suffix)
    const formattedNumber = phoneNumber.replace(/\D/g, '') + '@c.us';
    
    // Check if number is registered on WhatsApp
    const isRegistered = await state.client.isRegisteredUser(formattedNumber);
    if (!isRegistered) {
      return {
        success: false,
        message: `Phone number ${phoneNumber} is not registered on WhatsApp`,
      };
    }

    // Send the message
    await state.client.sendMessage(formattedNumber, message);
    
    return {
      success: true,
      message: 'Message sent successfully',
    };
  } catch (error) {
    console.error('❌ Failed to send WhatsApp message:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}

/**
 * Disconnect WhatsApp client
 */
export async function disconnectWhatsApp(): Promise<void> {
  if (state.client) {
    await state.client.destroy();
    state.client = null;
    state.status = 'disconnected';
    state.qrCode = null;
    state.organizationId = null;
  }
}

export default {
  getWhatsAppStatus,
  initializeWhatsApp,
  sendWhatsAppMessage,
  disconnectWhatsApp,
};
