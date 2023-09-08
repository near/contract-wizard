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

await esbuild.build({
  entryPoints: ['src/CodeGenerator.jsx', 'src/Test.jsx'],
  platform: 'browser',
  target: 'es2017',
  jsx: 'preserve',
  define: {
    SRC_DOC: JSON.stringify(srcDoc),
  },
  outdir: 'build',
  outExtension: { '.js': '.jsx' },
});
