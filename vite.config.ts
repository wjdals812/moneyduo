import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // vite dev에는 서버리스 함수(/api)가 없으므로 배포된 서버로 넘긴다 (로컬에서 api까지 고치려면 `vercel dev` 사용)
  server: {
    proxy: { '/api': { target: 'https://moneyduo.vercel.app', changeOrigin: true } },
  },
})