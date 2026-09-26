import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {createRealmService} from './server/realm-service';

export default defineConfig(() => {
  return {
    // Keep Vite's root aligned with the canonical config-file path. This avoids
    // cross-drive relative paths when the workspace is launched through a mapped drive.
    root: path.resolve(__dirname, '.'),
    plugins: [react(), tailwindcss(),{
      name:'kryvora-shared-realms',
      configureServer(server){const realm=createRealmService();server.middlewares.use(realm.handle);server.httpServer?.on('close',()=>realm.close());},
      configurePreviewServer(server){const realm=createRealmService();server.middlewares.use(realm.handle);server.httpServer?.on('close',()=>realm.close());},
    }],
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': 'http://localhost:4190',
      },
    },
  };
});
