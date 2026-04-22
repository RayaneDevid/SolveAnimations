const BOT_URL    = Deno.env.get('BOT_WEBHOOK_URL')!
const BOT_SECRET = Deno.env.get('BOT_WEBHOOK_SECRET')!

export async function notifyBot(route: string, payload: unknown): Promise<void> {
  try {
    const res = await fetch(`${BOT_URL}/webhook/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': BOT_SECRET,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`Bot webhook ${route} failed: ${res.status}`)
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.error(`Bot webhook ${route} error:`, err)
  }
}
