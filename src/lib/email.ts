import nodemailer from 'nodemailer'

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

function fromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@ducksaas.local'
}

async function sendMail(to: string, subject: string, text: string, html?: string) {
  if (!smtpConfigured()) {
    // Dev fallback: log instead of sending.
    console.log(`[email:skipped] to=${to} subject="${subject}"\n${text}`)
    return { sent: false as const, reason: 'smtp_not_configured' as const }
  }
  const port = Number(process.env.SMTP_PORT || 587)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  })
  await transporter.sendMail({ from: fromAddress(), to, subject, text, html })
  return { sent: true as const }
}

export async function sendWelcomeEmail(params: { to: string; name: string; orgName: string; role: string; tempPassword?: string }) {
  const { to, name, orgName, role, tempPassword } = params
  const subject = `Welcome to ${orgName} on DuckSaaS/Maskani`
  const text = [
    `Hi ${name},`,
    '',
    `You've been added to "${orgName}" as ${role.replace('_', ' ')}.`,
    '',
    'Sign in at the portal URL shared by your administrator.',
    tempPassword ? `Temporary password: ${tempPassword} (please change it after signing in)` : '',
    '',
    '— DuckSaaS/Maskani',
  ].filter(Boolean).join('\n')
  return sendMail(to, subject, text)
}

export async function sendPaymentReceiptEmail(params: {
  to: string
  tenantName: string
  organizationName: string
  invoiceNumber: string
  amount: number
  currency: string
  method: string
  paidAt: Date
}) {
  const subject = `Payment received — ${params.invoiceNumber}`
  const text = [
    `Hi ${params.tenantName},`,
    '',
    `We received your payment of ${params.currency} ${params.amount.toFixed(2)} for invoice ${params.invoiceNumber} (${params.organizationName}) via ${params.method.replace('_', ' ')} on ${params.paidAt.toLocaleDateString()}.`,
    '',
    'Thank you!',
    '',
    '— DuckSaaS/Maskani',
  ].join('\n')
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #0f766e;">Payment Received</h2>
      <p>Hi ${params.tenantName},</p>
      <p>We received your payment of <strong>${params.currency} ${params.amount.toLocaleString()}</strong> for invoice <strong>${params.invoiceNumber}</strong> (${params.organizationName}) via ${params.method.replace('_', ' ')} on ${params.paidAt.toLocaleDateString()}.</p>
      <p>Thank you!</p>
    </div>
  `
  return sendMail(params.to, subject, text, html)
}

export async function sendPaymentReminderEmail(params: {
  to: string
  tenantName: string
  organizationName: string
  invoiceNumber: string
  amountDue: number
  amountPaid: number
  currency: string
  dueDate: Date
  portalUrl: string
}) {
  const balance = params.amountDue - params.amountPaid
  const subject = `Payment reminder — ${params.invoiceNumber} is overdue`
  const text = [
    `Hi ${params.tenantName},`,
    '',
    `Your invoice ${params.invoiceNumber} for ${params.organizationName} was due on ${params.dueDate.toLocaleDateString()} and is now overdue.`,
    `Outstanding balance: ${params.currency} ${balance.toFixed(2)} (of ${params.currency} ${params.amountDue.toFixed(2)})`,
    '',
    `Pay now: ${params.portalUrl}`,
    '',
    '— DuckSaaS/Maskani',
  ].join('\n')
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #b91c1c;">Payment Reminder</h2>
      <p>Hi ${params.tenantName},</p>
      <p>Your invoice <strong>${params.invoiceNumber}</strong> for <strong>${params.organizationName}</strong> was due on ${params.dueDate.toLocaleDateString()} and is now overdue.</p>
      <p>Outstanding balance: <strong>${params.currency} ${balance.toLocaleString()}</strong> (of ${params.currency} ${params.amountDue.toLocaleString()})</p>
      <p><a href="${params.portalUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Pay now in your portal</a></p>
    </div>
  `
  return sendMail(params.to, subject, text, html)
}

export async function sendInvoiceEmail(params: { to: string; name: string; orgName: string; invoiceNumber: string; amount: number; currency: string; dueDate: string }) {
  const { to, name, orgName, invoiceNumber, amount, currency, dueDate } = params
  const subject = `Invoice ${invoiceNumber} from ${orgName}`
  const text = [
    `Hi ${name},`,
    '',
    `A new invoice is available from ${orgName}:`,
    `Invoice: ${invoiceNumber}`,
    `Amount due: ${currency} ${amount.toFixed(2)}`,
    `Due date: ${dueDate}`,
    '',
    'You can view and pay it in your tenant portal.',
    '',
    '— DuckSaaS/Maskani',
  ].join('\n')
  return sendMail(to, subject, text)
}
