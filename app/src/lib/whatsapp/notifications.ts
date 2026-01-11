/**
 * WhatsApp Notification Client Library
 * 
 * Provides functions to trigger WhatsApp notifications from the frontend.
 */

export interface NotificationResult {
  success: boolean;
  message?: string;
  error?: string;
  whatsappSent?: boolean;
  whatsappError?: string;
  data?: Record<string, unknown>;
}

/**
 * Send trip assignment notification to a driver
 */
export async function notifyTripAssignment(
  tripId: string,
  sendImmediately: boolean = false
): Promise<NotificationResult> {
  try {
    const response = await fetch("/api/notifications/trip-assigned", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tripId, sendImmediately }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send notification",
    };
  }
}

/**
 * Send invoice payment reminder to a customer
 */
export async function sendInvoiceReminder(
  invoiceId: string,
  sendImmediately: boolean = false
): Promise<NotificationResult> {
  try {
    const response = await fetch("/api/notifications/invoice-reminder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invoiceId, sendImmediately }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send reminder",
    };
  }
}

/**
 * Check WhatsApp connection status via the agent
 */
export async function checkWhatsAppStatus(): Promise<{
  connected: boolean;
  status: string;
  error?: string;
}> {
  try {
    const response = await fetch("/api/whatsapp/status");
    const result = await response.json();
    return {
      connected: result.status === "ready",
      status: result.status,
    };
  } catch (error) {
    return {
      connected: false,
      status: "error",
      error: error instanceof Error ? error.message : "Failed to check status",
    };
  }
}
