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
  let copy: File | null = null;
  if (!uri || !new File(uri).exists) {
    copy = new File(Paths.cache, o.attachment.name);
    if (copy.exists) copy.delete();
    copy.create();
    copy.write(o.attachment.text);
    uri = copy.uri;
  }
  if (await MailComposer.isAvailableAsync().catch(() => false)) {
    try {
      const r = await MailComposer.composeAsync({ recipients: [o.to], subject: o.subject, body: o.body, attachments: [uri] });
      return r.status === 'sent' || r.status === 'saved' || r.status === 'undetermined' ? 'mail' : 'cancelled';
    } finally {
      // The mail app has its own copy of the attachment by now.
      try {
        if (copy?.exists) copy.delete();
      } catch {}
    }
  }
  // Shared files stay: on Android the other app may read it after this returns.
  await Sharing.shareAsync(uri, { mimeType: o.attachment.mime, dialogTitle: o.to });
  return 'share';
}

