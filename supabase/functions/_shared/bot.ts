const BOT_URL    = Deno.env.get('BOT_WEBHOOK_URL')!
const BOT_SECRET = Deno.env.get('BOT_WEBHOOK_SECRET')!

export async function notifyBot<T = Record<string, unknown>>(
  route: string,
  payload: unknown,
): Promise<T | null> {
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
      return null
    }
    return await res.json() as T
  } catch (err) {
    console.error(`Bot webhook ${route} error:`, err)
    return null
  }
}
