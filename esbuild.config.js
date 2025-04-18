
// esbuild.config.js
module.exports = {
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  external: [
    'lightningcss',
    'module',
    'url',
    // Add other problematic dependencies here if needed
  ]
}
