import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import type { ProxyOptions } from 'vite'  

function withProxyErrorFilter(options: ProxyOptions): ProxyOptions {
  return {
    ...options,
    configure(proxy) {
      proxy.on('error', (err: any) => {
        // Nuốt riêng lỗi server backend chưa chạy, tránh spam log ECONNREFUSED
        if (err?.code === 'ECONNREFUSED') {
          return
        }
        // Các lỗi khác vẫn log bình thường để debug khi cần
        console.error('[proxy error]', err?.message || err)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // Load biến từ file .env
  const targetUrl = env.VITE_API_URL || 'http://backend_ppg:3001'
  return {
    plugins: [vue(), tailwindcss()],
    server: {
      host: true, 
      port: 5174,      
      strictPort: true,
      proxy: {
        '/api': {
          ...withProxyErrorFilter({
            target: targetUrl,
            changeOrigin: true,
            rewrite: (path) => path,
          }),
        },
        '/uploads': {
          ...withProxyErrorFilter({
            target: targetUrl,
            changeOrigin: true,
            rewrite: (path) => path,
          }),
        },
      },
    },
  }
})
