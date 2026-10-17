// The text-recognition module, as the app sees it: missing (Expo Go, web) or
// there. No React Native import here, so the missing-module path is tested.

export interface TextExtractor {
  isSupported: boolean;
  extractTextFromImage(path: string): Promise<string[]>;
}

export interface Reader {
  /** False in Expo Go and on the web: the entry says it comes with the store version. */
  available: boolean;
  /** The lines found in the photo; null when it couldn't be read here. */
  read(uri: string): Promise<string[] | null>;
}

/** `load` runs once, and throwing (no module in this build) counts as missing. */
export function makeReader(load: () => TextExtractor | null): Reader {
  let mod: TextExtractor | null = null;
  try {
    mod = load();
  } catch {
    mod = null;
  }
  const available = !!mod?.isSupported;
  return {
    available,
    async read(uri) {
      if (!mod || !available) return null;
      try {
        return await mod.extractTextFromImage(uri.replace('file://', ''));
      } catch {
        return null;
      }
    },
  };
}
