import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  target: 'es2017',
  outfile: 'dist/index.js',
});
