import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  platform: 'browser',
  target: 'es2017',
  outfile: 'build/index.js',
});