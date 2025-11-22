import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Logic map biến môi trường chuyên nghiệp:
      // 1. Ưu tiên VITE_API_KEY (Chuẩn Vite/Vercel Frontend)
      // 2. Dự phòng API_KEY (Chuẩn Node/Backend)
      // 3. Map vào process.env.API_KEY để SDK sử dụng
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY)
    }
  };
});