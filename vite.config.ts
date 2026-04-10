import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isNativeBuild = mode === 'native'

  return {
    base: command === 'serve' ? '/' : isNativeBuild ? './' : '/financial-tracker/',
    build: {
      outDir: isNativeBuild ? 'dist-native' : 'dist',
      emptyOutDir: true,
    },
    plugins: [react()],
  }
})
