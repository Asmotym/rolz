import { defineConfig } from 'tsup';
import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';

const sentryBuildConfigured = Boolean(
    process.env.SENTRY_AUTH_TOKEN
    && process.env.SENTRY_ORG
    && process.env.SENTRY_PROJECT
    && process.env.SENTRY_RELEASE
);

export default defineConfig({
    entry: {
        index: 'server/index.ts',
        'verify-sentry': 'server/scripts/verify-sentry.ts'
    },
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
    esbuildPlugins: sentryBuildConfigured
        ? [
            sentryEsbuildPlugin({
                org: process.env.SENTRY_ORG,
                project: process.env.SENTRY_PROJECT,
                authToken: process.env.SENTRY_AUTH_TOKEN,
                telemetry: false,
                release: {
                    name: process.env.SENTRY_RELEASE
                },
                sourcemaps: {
                    assets: './dist-server/**',
                    filesToDeleteAfterUpload: './dist-server/**/*.map'
                }
            })
        ]
        : [],
    env: {
        NODE_ENV: 'production'
    }
});
