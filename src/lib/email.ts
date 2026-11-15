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
