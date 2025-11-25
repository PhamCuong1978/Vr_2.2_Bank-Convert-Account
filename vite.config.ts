import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Logic tìm kiếm API Key theo thứ tự ưu tiên:
  const apiKey = env.VITE_API_KEY || env.API_KEY || process.env.API_KEY;
  const deepseekKey = env.VITE_DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

  return {
    plugins: [react()],
    define: {
      // Map giá trị tìm được vào process.env để client sử dụng
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(deepseekKey)
    }
  };
});