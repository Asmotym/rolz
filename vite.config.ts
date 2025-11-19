import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const host = env.VITE_DEV_SERVER_HOST ?? '0.0.0.0';
  const port = Number(env.VITE_DEV_SERVER_PORT ?? 5173);
  const url = `${host}:${port}`

  return {
    plugins: [vue()],
    server: {
      host,
      port,
      allowedHosts: env.ENVIRONMENT === 'development' ? [url] : ['rolz.asmotym.fr']
    },
    resolve: {
      alias: {
        core: path.resolve(__dirname, 'src/core'),
        modules: path.resolve(__dirname, 'src/modules'),
        netlify: path.resolve(__dirname, 'server'),
        assets: path.resolve(__dirname, 'src/assets'),
      }
    },
    preview: {
      allowedHosts: ['rolz.asmotym.fr']
    }
  };
});
