
// esbuild.config.js
module.exports = {
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  external: [
    'lightningcss',
    // Add other problematic dependencies here if needed
  ]
}
