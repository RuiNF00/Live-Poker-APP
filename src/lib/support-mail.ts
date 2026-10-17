// Web: download the file and open a pre-filled email; the player attaches it
// (a mailto: link can't carry a file).

export type SentVia = 'mail' | 'share' | 'cancelled';

export async function mailSupport(o: { to: string; subject: string; body: string; attachment: { name: string; uri?: string; text: string; mime: string } }): Promise<SentVia> {
  const url = o.attachment.uri ?? URL.createObjectURL(new Blob([o.attachment.text], { type: o.attachment.mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = o.attachment.name;
  a.click();
  window.location.href = `mailto:${o.to}?subject=${encodeURIComponent(o.subject)}&body=${encodeURIComponent(o.body)}`;
  return 'share';
}
