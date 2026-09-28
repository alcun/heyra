// @ts-check
import { defineConfig } from 'astro/config';

// Styles inline, so the fonts they name are found without another request.
export default defineConfig({ build: { inlineStylesheets: 'always' } });
