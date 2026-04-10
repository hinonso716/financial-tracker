import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const buildTarget =
    mode === 'native' ? 'native' : mode === 'pages' ? 'pages' : 'hosting'

  const base =
    command === 'serve'
      ? '/'
      : buildTarget === 'native'
        ? './'
        : buildTarget === 'pages'
          ? '/financial-tracker/'
          : '/'

  const outDir =
    buildTarget === 'native'
      ? 'dist-native'
      : buildTarget === 'pages'
        ? 'dist-pages'
        : 'dist'

  return {
    base,
    build: {
      outDir,
      emptyOutDir: true,
    },
    plugins: [react()],
  }
})
