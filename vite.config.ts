import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Build targets
//   vite build                  → dist/          full web app (staff + admin + public)
//   vite build --mode student   → dist-student/  SchoolSync (student app)
//   vite build --mode attend    → dist-attend/   SchoolSync Attend (NFC scanner)
//
// --mode is used rather than an env var so the same command works in
// PowerShell, cmd and bash without cross-env.

const TARGETS = {
  student: { entry: 'student.html', outDir: 'dist-student' },
  attend:  { entry: 'attend.html',  outDir: 'dist-attend'  },
} as const

type TargetName = keyof typeof TARGETS

/**
 * Capacitor expects index.html at the root of its webDir, but each mobile
 * target's entry is named for the app. Rename it once the bundle is written.
 */
function entryAsIndex(entry: string, outDir: string) {
  return {
    name: 'entry-as-index',
    closeBundle() {
      const dir = path.resolve(__dirname, outDir)
      const from = path.join(dir, entry)
      const to = path.join(dir, 'index.html')
      if (fs.existsSync(from)) fs.renameSync(from, to)
    },
  }
}

export default defineConfig(({ mode }) => {
  const target = TARGETS[mode as TargetName]

  return {
    plugins: [
      react(),
      ...(target ? [entryAsIndex(target.entry, target.outDir)] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    ...(target && {
      build: {
        outDir: target.outDir,
        emptyOutDir: true,
        rollupOptions: {
          input: path.resolve(__dirname, target.entry),
        },
      },
    }),
  }
})
