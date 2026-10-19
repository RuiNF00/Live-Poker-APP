// Native: render the HTML to a PDF and open the share sheet (Files, Mail,
// WhatsApp…), under a readable file name.

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export async function sharePdf(name: string, html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const out = new File(Paths.cache, name);
  if (out.exists) out.delete();
  await new File(uri).move(out);
  await Sharing.shareAsync(out.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
}
