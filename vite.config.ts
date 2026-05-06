import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const singleFile = process.env.SINGLE_FILE === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: singleFile ? [react(), viteSingleFile()] : [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/KATOU-HOME/' : '/',
})
