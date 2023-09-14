import * as esbuild from 'esbuild';

const srcDocJsBuildResult = await esbuild.build({
  entryPoints: ['src/srcDoc.ts'],
  write: false,
  bundle: true,
  minify: true,
  platform: 'browser',
  target: 'es2017',
});

const srcDocJs = srcDocJsBuildResult.outputFiles[0].text;

const srcDoc = `<html><body><script>${srcDocJs}</script></body></html>`;

const outdir =
  process.env.NODE_ENV === 'production' ? 'build/prod/src' : 'build/dev/src';

const entryPoints =
  process.env.NODE_ENV === 'production'
    ? ['src/CodeGenerator.jsx']
    : ['src/CodeGenerator.jsx', 'src/Test.jsx'];

await esbuild.build({
  entryPoints,
  platform: 'browser',
  target: 'es2017',
  jsx: 'preserve',
  define: {
    SRC_DOC: JSON.stringify(srcDoc),
  },
  outdir,
  outExtension: { '.js': '.jsx' },
});
