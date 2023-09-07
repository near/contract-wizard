import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'es2017',
  outfile: 'build/cli.js',
});
