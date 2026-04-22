const BOT_URL    = Deno.env.get('BOT_WEBHOOK_URL')!
const BOT_SECRET = Deno.env.get('BOT_WEBHOOK_SECRET')!

const BOT_TIMEOUT_MS = 8_000

export async function notifyBot<T = Record<string, unknown>>(
  route: string,
  payload: unknown,
): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BOT_TIMEOUT_MS)
  try {
    const res = await fetch(`${BOT_URL}/webhook/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': BOT_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      console.error(`Bot webhook ${route} failed: ${res.status}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    clearTimeout(timer)
    console.error(`Bot webhook ${route} error:`, err)
    return null
  }
}
