import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  // Logic tìm kiếm API Key theo thứ tự ưu tiên:
  // 1. env.VITE_API_KEY: Cấu hình chuẩn trên Vercel (Environment Variables).
  // 2. env.API_KEY: Cấu hình trong file .env hoặc biến hệ thống Node.
  // 3. process.env.API_KEY: Biến môi trường có sẵn của hệ thống (thường dùng trong AI Studio).
  const apiKey = env.VITE_API_KEY || env.API_KEY || process.env.API_KEY;

  return {
    plugins: [react()],
    define: {
      // Map giá trị tìm được vào process.env.API_KEY để client sử dụng
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});