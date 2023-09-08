import * as esbuild from 'esbuild';

const srcDocBuildResult = await esbuild.build({
  entryPoints: ['src/srcDoc.ts'],
  write: false,
  bundle: true,
  minify: true,
  platform: 'browser',
  target: 'es2017',
});

const srcDocCode = srcDocBuildResult.outputFiles[0].text;

const srcDoc = `
<html>
<body>
<script>
${srcDocCode}
</script>
</body>
</html>
`;

await esbuild.build({
  entryPoints: ['src/CodeGenerator.jsx'],
  platform: 'browser',
  target: 'es2017',
  jsx: 'preserve',
  define: {
    SRCDOC: JSON.stringify(srcDoc),
  },
  outfile: 'build/CodeGenerator.jsx',
});
