import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
const useSsl=process.env.HTTPS==='1';const aquariumIndex=():Plugin=>({name:'aquarium-index',enforce:'post',generateBundle(_options,bundle){const html=bundle['aquarium.html'];if(!html)return;delete bundle['aquarium.html'];html.fileName='index.html';bundle['index.html']=html;}});
export default defineConfig({plugins:[...(useSsl?[basicSsl()]:[]),viteSingleFile(),aquariumIndex()],publicDir:false,build:{outDir:'dist-aquarium',emptyOutDir:true,rollupOptions:{input:'aquarium.html'}}});
