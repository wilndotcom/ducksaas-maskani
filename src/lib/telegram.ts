type TelegramPayload = {
  text: string
}

async function postTelegram(payload: TelegramPayload) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: payload.text.slice(0, 3800),
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
    })
  } catch {
    // best-effort notification; never block app flow
  }
}

export async function notifyTelegram(message: string, meta?: Record<string, unknown>) {
  const metaLine = meta && Object.keys(meta).length
    ? '\n' + Object.entries(meta).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')
    : ''
  const text = `[DuckSaaS/Maskani]\n${message}${metaLine}`.slice(0, 4000)
  await postTelegram({ text })
}