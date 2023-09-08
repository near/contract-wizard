import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  CodeGenerationOptions,
  FungibleToken,
  Owner,
  Pause,
  generateCode,
} from './lib';

const tests: (() => CodeGenerationOptions)[] = [
  () => ({
    token: new FungibleToken({
      name: 'My Fungible Token',
      symbol: 'MFT',
      decimals: 24,
      preMint: '0',
    }),
    plugins: [],
  }),
  () => ({
    token: new FungibleToken({
      name: 'My Fungible Token',
      symbol: 'MFT',
      decimals: 24,
      preMint: '1000',
    }),
    plugins: [new Owner({}), new Pause({})],
  }),
];

for (const test of tests) {
  const code = generateCode(test());
  fs.writeFileSync('tests/src/lib.rs', code, {
    encoding: 'utf-8',
  });

  try {
    execSync('cargo build --release --target wasm32-unknown-unknown', {
      cwd: path.join(__dirname, '..', 'tests'),
      stdio: 'inherit',
    });
  } catch (e) {
    console.error(`Failed to compile generated code`);
    console.error(test());
    process.exit(1);
  }
}
