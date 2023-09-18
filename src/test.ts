import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  CodeGenerationOptions,
  FungibleToken,
  NonFungibleToken,
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
      mintable: true,
      burnable: true,
    }),
    plugins: [],
  }),
  () => ({
    token: new FungibleToken({
      name: 'My Fungible Token',
      symbol: 'MFT',
      decimals: 24,
      preMint: '1000',
      mintable: false,
      burnable: false,
    }),
    plugins: [new Owner({}), new Pause({})],
  }),
  () => ({
    token: new NonFungibleToken({
      name: 'My Fungible Token',
      symbol: 'MFT',
    }),
    plugins: [],
  }),
  () => ({
    token: new NonFungibleToken({
      name: 'My Fungible Token',
      symbol: 'MFT',
    }),
    plugins: [new Owner({}), new Pause({})],
  }),
];

for (const test of tests) {
  const options = test();
  const code = generateCode(options);
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
    console.error(options);
    process.exit(1);
  }
}
