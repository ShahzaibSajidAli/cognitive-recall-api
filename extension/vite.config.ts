import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        outDir: resolve(__dirname, 'build'),
        rollupOptions: {
            input: {
                background: resolve(__dirname, 'src/background-script.ts'),
                popup: resolve(__dirname, 'popup.html'),
                content: resolve(__dirname, 'src/content-script.ts')
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]'
            }
        }
    }
})