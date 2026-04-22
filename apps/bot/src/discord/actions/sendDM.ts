import client from '../client.js';

/**
 * Sends a DM to a Discord user by their Discord user ID.
 * Errors are caught and logged — they do NOT propagate to callers.
 */
export async function sendDM(discordUserId: string, content: string): Promise<void> {
  try {
    const user = await client.users.fetch(discordUserId);
    await user.send(content);
  } catch (err) {
    console.warn(`[sendDM] Failed to send DM to ${discordUserId}:`, err);
  }
}
