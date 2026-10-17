import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The app's "@/..." imports, so route handlers can be tested as they are.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
