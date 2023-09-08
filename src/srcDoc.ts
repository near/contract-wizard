import { CodeGenerationOptionsPojo, generateCode } from './lib';

window.addEventListener('message', (e) => {
  window.top!.postMessage(
    generateCode(e.data as CodeGenerationOptionsPojo),
    '*',
  );
});
