import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const useSsl = process.env.HTTPS === '1';
const pvIndex = (): Plugin => ({
  name: 'pv-index',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const html = bundle['pv.html'];
    if (!html) return;
    delete bundle['pv.html'];
    html.fileName = 'index.html';
    bundle['index.html'] = html;
  },
});

export default defineConfig({
  plugins: [...(useSsl ? [basicSsl()] : []), viteSingleFile(), pvIndex()],
  publicDir: false,
  build: {
    outDir: 'dist-pv',
    emptyOutDir: true,
    rollupOptions: { input: 'pv.html' },
  },
});
