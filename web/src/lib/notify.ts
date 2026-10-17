import 'server-only';

/**
 * Tells the team something needs a human (a hand or comment hidden by reports). Posts to
 * MODERATION_WEBHOOK_URL when set (Slack, Discord, or a Zapier/Make hook that emails);
 * otherwise only logs. Never throws.
 */
export async function notifyModeration(text: string): Promise<void> {
  console.warn('[moderation]', text);
  const url = process.env.MODERATION_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }) });
  } catch {
    // best effort
  }
}
