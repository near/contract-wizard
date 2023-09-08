import { CodeGenerationOptionsPojo, generateCode } from './index';

window.addEventListener('message', (e) => {
  window.top!.postMessage(
    generateCode(e.data as CodeGenerationOptionsPojo),
    '*',
  );
});
