// @ts-check
import { defineConfig } from 'astro/config';

// Styles inline, so the fonts they name are found without another request.
// In development, HEYRA_DEV_API points /v1 and /healthz at a running Heyra server.
const api = process.env.HEYRA_DEV_API;
export default defineConfig({
  build: { inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
  vite: api ? { server: { proxy: { '/v1': { target: api, changeOrigin: true }, '/healthz': { target: api, changeOrigin: true } } } } : {},
});
