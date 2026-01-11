import nodemailer from "nodemailer";

// Create reusable transporter object using SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  const { to, subject, text, html } = options;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html: html || text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendSupervisorCredentials(email: string, password: string) {
  const appUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  
  return sendEmail({
    to: email,
    subject: "Welcome to WD Logistics - Your Account Credentials",
    text: `
Welcome to WD Logistics!

You have been added as a Supervisor. Here are your login credentials:

Email: ${email}
Password: ${password}

Please login at: ${appUrl}/sign-in

For security, please change your password after your first login.

Best regards,
WD Logistics Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a1a2e; }
    .credentials p { margin: 8px 0; }
    .credentials strong { color: #1a1a2e; }
    .button { display: inline-block; background: #1a1a2e; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .warning { color: #666; font-size: 14px; margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to WD Logistics</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>You have been added as a <strong>Supervisor</strong> to the WD Logistics platform.</p>
      
      <div class="credentials">
        <h3>Your Login Credentials</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>
      
      <a href="${appUrl}/sign-in" class="button">Login Now</a>
      
      <div class="warning">
        <strong>Security Notice:</strong> For your security, please change your password after your first login.
      </div>
      
      <p style="margin-top: 30px;">Best regards,<br>WD Logistics Team</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}

// Generate a random secure password
export function generateRandomPassword(length: number = 12): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  // Ensure at least one of each type
  let password = "";
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Send invoice email to customer
 */
export interface InvoiceEmailData {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  tax: number;
  total: number;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  organizationName?: string;
  notes?: string;
}

export async function sendInvoiceEmail(data: InvoiceEmailData) {
  const orgName = data.organizationName || "WD Logistics";
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  const formatDate = (date: Date) => 
    new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(date);

  const itemsHtml = data.items && data.items.length > 0
    ? `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #1e40af;">Description</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #1e40af;">Qty</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #1e40af;">Unit Price</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #1e40af;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((item, idx) => `
            <tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
              <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
              <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${formatCurrency(item.unitPrice)}</td>
              <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${formatCurrency(item.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '';

  return sendEmail({
    to: data.customerEmail,
    subject: `Invoice ${data.invoiceNumber} from ${orgName}`,
    text: `
Dear ${data.customerName},

Please find attached your invoice details:

Invoice Number: ${data.invoiceNumber}
Issue Date: ${formatDate(data.issueDate)}
Due Date: ${formatDate(data.dueDate)}

Subtotal: ${formatCurrency(data.subtotal)}
Tax: ${formatCurrency(data.tax)}
Total Due: ${formatCurrency(data.total)}

${data.notes ? `Notes: ${data.notes}` : ''}

Thank you for your business.

Best regards,
${orgName}
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; opacity: 0.9; }
    .content { padding: 30px; background: #fff; }
    .invoice-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .invoice-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .invoice-row:last-child { border-bottom: none; }
    .invoice-label { color: #666; }
    .invoice-value { font-weight: 600; }
    .totals { background: #1e40af; color: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .totals-row.total { font-size: 18px; font-weight: bold; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 10px; margin-top: 10px; }
    .notes { background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #f59e0b; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${orgName}</h1>
      <p>Invoice ${data.invoiceNumber}</p>
    </div>
    <div class="content">
      <p>Dear ${data.customerName},</p>
      <p>Thank you for your business. Please find your invoice details below:</p>
      
      <div class="invoice-details">
        <div class="invoice-row">
          <span class="invoice-label">Invoice Number:</span>
          <span class="invoice-value">${data.invoiceNumber}</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-label">Issue Date:</span>
          <span class="invoice-value">${formatDate(data.issueDate)}</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-label">Due Date:</span>
          <span class="invoice-value">${formatDate(data.dueDate)}</span>
        </div>
      </div>

      ${itemsHtml}

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(data.subtotal)}</span>
        </div>
        <div class="totals-row">
          <span>Tax:</span>
          <span>${formatCurrency(data.tax)}</span>
        </div>
        <div class="totals-row total">
          <span>Total Due:</span>
          <span>${formatCurrency(data.total)}</span>
        </div>
      </div>

      ${data.notes ? `
        <div class="notes">
          <strong>Notes:</strong> ${data.notes}
        </div>
      ` : ''}

      <p style="margin-top: 30px;">If you have any questions, please don't hesitate to contact us.</p>
      <p>Best regards,<br><strong>${orgName}</strong></p>
    </div>
    <div class="footer">
      <p>This invoice was generated automatically by ${orgName}.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}

/**
 * Send invoice payment reminder email
 */
export interface InvoiceReminderEmailData {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  dueDate: Date;
  total: number;
  balance: number;
  isOverdue: boolean;
  daysOverdue?: number;
  organizationName?: string;
}

export async function sendInvoiceReminderEmail(data: InvoiceReminderEmailData) {
  const orgName = data.organizationName || "WD Logistics";
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(date);

  const subject = data.isOverdue
    ? `⚠️ Overdue Invoice ${data.invoiceNumber} - Payment Required`
    : `Payment Reminder: Invoice ${data.invoiceNumber} Due Soon`;

  const urgencyMessage = data.isOverdue
    ? `This invoice is now <strong>${data.daysOverdue || 0} days overdue</strong>. Please arrange payment immediately to avoid any service interruptions.`
    : `This is a friendly reminder that your invoice is due on <strong>${formatDate(data.dueDate)}</strong>.`;

  const headerColor = data.isOverdue ? "#dc2626" : "#1e40af";
  const statusBadge = data.isOverdue
    ? `<span style="background: #fef2f2; color: #dc2626; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">OVERDUE</span>`
    : `<span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">DUE SOON</span>`;

  return sendEmail({
    to: data.customerEmail,
    subject,
    text: `
Dear ${data.customerName},

${data.isOverdue ? `OVERDUE NOTICE: Invoice #${data.invoiceNumber} is ${data.daysOverdue || 0} days overdue.` : `PAYMENT REMINDER: Invoice #${data.invoiceNumber} is due on ${formatDate(data.dueDate)}.`}

Invoice Number: ${data.invoiceNumber}
Due Date: ${formatDate(data.dueDate)}
Total Amount: ${formatCurrency(data.total)}
Balance Due: ${formatCurrency(data.balance)}

Please arrange payment at your earliest convenience.

If you have already made this payment, please disregard this notice or contact us to update our records.

Thank you for your business.

Best regards,
${orgName}
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${headerColor}; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; opacity: 0.9; }
    .content { padding: 30px; background: #fff; }
    .status-badge { text-align: center; margin: -15px 0 20px; }
    .alert-box { background: ${data.isOverdue ? '#fef2f2' : '#fef3c7'}; border-left: 4px solid ${data.isOverdue ? '#dc2626' : '#f59e0b'}; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
    .invoice-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .invoice-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .invoice-row:last-child { border-bottom: none; font-weight: bold; font-size: 18px; color: ${headerColor}; }
    .invoice-label { color: #666; }
    .invoice-value { font-weight: 600; }
    .cta-button { display: block; text-align: center; margin: 30px 0; }
    .cta-button a { background: ${headerColor}; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #e5e7eb; margin-top: 20px; }
    .disclaimer { background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 12px; color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${orgName}</h1>
      <p>Payment Reminder</p>
    </div>
    <div class="content">
      <div class="status-badge">
        ${statusBadge}
      </div>
      
      <p>Dear ${data.customerName},</p>
      
      <div class="alert-box">
        ${urgencyMessage}
      </div>

      <div class="invoice-details">
        <div class="invoice-row">
          <span class="invoice-label">Invoice Number:</span>
          <span class="invoice-value">${data.invoiceNumber}</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-label">Due Date:</span>
          <span class="invoice-value">${formatDate(data.dueDate)}</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-label">Total Amount:</span>
          <span class="invoice-value">${formatCurrency(data.total)}</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-label">Balance Due:</span>
          <span class="invoice-value">${formatCurrency(data.balance)}</span>
        </div>
      </div>

      <p>Please arrange payment at your earliest convenience to keep your account in good standing.</p>

      <div class="disclaimer">
        <strong>Already paid?</strong> If you have already made this payment, please disregard this notice. 
        It may take a few days for payments to be processed and reflected in our system.
      </div>

      <p style="margin-top: 30px;">Thank you for your continued business.</p>
      <p>Best regards,<br><strong>${orgName}</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated payment reminder from ${orgName}.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });
}
