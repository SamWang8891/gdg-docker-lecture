import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    define: {
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
});
