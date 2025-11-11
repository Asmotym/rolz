import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['server/index.ts'],
    outDir: 'dist-server',
    format: ['esm'],
    target: 'node20',
    platform: 'node',
    sourcemap: true,
    splitting: false,
    clean: true,
    dts: false,
    bundle: true,
    minify: false,
    shims: false,
    env: {
        NODE_ENV: 'production'
    }
});
