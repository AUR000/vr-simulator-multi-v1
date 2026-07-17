import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// HTTPS(basic-ssl) は Quest 実機テスト時のみ有効化: HTTPS=1 npx vite --host
const useSsl = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [...(useSsl ? [basicSsl()] : []), viteSingleFile()],
});
