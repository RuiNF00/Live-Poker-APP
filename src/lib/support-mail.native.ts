// Sending a file to support from the phone: the mail app opens with the
// address, subject, a short note and the file attached, and the player sends
// it (or not). Without a mail account set up, the share sheet instead.

import { File, Paths } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';

export type SentVia = 'mail' | 'share' | 'cancelled';

export async function mailSupport(o: { to: string; subject: string; body: string; attachment: { name: string; uri?: string; text: string; mime: string } }): Promise<SentVia> {
  // The file as it was picked when we still have it; else the text, written to the cache.
  let uri = o.attachment.uri;
  if (!uri || !new File(uri).exists) {
    const f = new File(Paths.cache, o.attachment.name);
    if (f.exists) f.delete();
    f.create();
    f.write(o.attachment.text);
    uri = f.uri;
  }
  if (await MailComposer.isAvailableAsync().catch(() => false)) {
    const r = await MailComposer.composeAsync({ recipients: [o.to], subject: o.subject, body: o.body, attachments: [uri] });
    return r.status === 'sent' || r.status === 'saved' || r.status === 'undetermined' ? 'mail' : 'cancelled';
  }
  await Sharing.shareAsync(uri, { mimeType: o.attachment.mime, dialogTitle: o.to });
  return 'share';
}
