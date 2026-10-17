// The sharer's language rides on every public link (?lang=pt-PT). WhatsApp, Telegram and Instagram
// fetch the link preview without a language, so the site would otherwise guess; the page itself
// still follows the reader's phone.

/** `url` with `lang=<variant>` in its query, before any #fragment (a swap group's invite rides there). */
export function withLang(url: string, lang: string): string {
  const at = url.indexOf('#');
  const base = at < 0 ? url : url.slice(0, at);
  const hash = at < 0 ? '' : url.slice(at);
  return `${base}${base.includes('?') ? '&' : '?'}lang=${encodeURIComponent(lang)}${hash}`;
}
