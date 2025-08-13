import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {} // Tambahkan ini jika belum ada
  }
})
// https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
