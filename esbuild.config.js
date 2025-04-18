
// esbuild.config.js - ESM版本
export default {
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  external: [
    'lightningcss',
    // 不要排除这些核心模块，它们需要被正确处理
    // 'module',
    // 'url',
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  }
}
