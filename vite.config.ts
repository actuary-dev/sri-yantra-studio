import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  // harfbuzzjs locates its .wasm via import.meta.url; pre-bundling would break that in dev
  optimizeDeps: { exclude: ['harfbuzzjs'] },
  build: { target: 'es2022' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.ttf', 'icon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ttf,wasm,woff2}'], maximumFileSizeToCacheInBytes: 8 * 1024 * 1024 },
      manifest: {
        name: 'Sri Yantra Studio',
        short_name: 'Sri Yantra',
        description: 'Design precise Sri Yantras for engraving and print',
        theme_color: '#f5f1e8',
        background_color: '#f5f1e8',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
