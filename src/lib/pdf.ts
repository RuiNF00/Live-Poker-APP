// Web: print the HTML from a hidden frame, so the browser's dialog offers
// "Save as PDF" for the report and not for the app around it.

export async function sharePdf(name: string, html: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html.replace('<title>', `<title>${name.replace(/\.pdf$/, '')} · `));
  doc.close();
  await new Promise((r) => setTimeout(r, 250));
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60000);
}
