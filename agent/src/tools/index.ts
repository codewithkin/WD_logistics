import { truckTools } from "./trucks";
import { tripTools } from "./trips";
import { driverTools } from "./drivers";
import { invoiceTools } from "./invoices";
import { whatsappTools } from "./whatsapp";

// Export all tools as a single object for the agent
export const allTools = {
  // Truck tools
  ...truckTools,
  // Trip tools
  ...tripTools,
  // Driver tools
  ...driverTools,
  // Invoice tools
  ...invoiceTools,
  // WhatsApp tools
  ...whatsappTools,
};

// Export individual tool categories
export { truckTools } from "./trucks";
export { tripTools } from "./trips";
export { driverTools } from "./drivers";
export { invoiceTools } from "./invoices";
export { whatsappTools } from "./whatsapp";
