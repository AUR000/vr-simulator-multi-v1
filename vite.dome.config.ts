import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const useSsl = process.env.HTTPS === '1';
const domeIndex = (): Plugin => ({
  name: 'dome-index',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const html = bundle['dome.html'];
    if (!html) return;
    delete bundle['dome.html'];
    html.fileName = 'index.html';
    bundle['index.html'] = html;
  },
});

export default defineConfig({
  plugins: [...(useSsl ? [basicSsl()] : []), viteSingleFile(), domeIndex()],
  publicDir: false,
  build: {
    outDir: 'docs/dome',
    emptyOutDir: true,
    rollupOptions: {
      input: 'dome.html',
    },
  },
});
