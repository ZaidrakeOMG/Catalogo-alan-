import { defineConfig } from 'astro/config';

// Sitio estático: ideal para Netlify y cualquier hosting compatible con Astro.
export default defineConfig({
  output: 'static',
  build: { format: 'directory' },
  vite: {
    build: { target: 'es2020' },
  },
});
