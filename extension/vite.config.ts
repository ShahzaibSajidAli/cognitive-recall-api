import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
    envDir: resolve(__dirname, '..'),
    envPrefix: ['VITE_', 'PUBLIC_'],
    define: {
        'import.meta.env.PUBLIC_IP': JSON.stringify(loadEnv(mode, resolve(__dirname, '..'), '').PUBLIC_IP)
    },
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
}));