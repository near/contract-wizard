import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  CodeGenerationOptions,
  FungibleToken,
  NonFungibleToken,
  Owner,
  Pause,
  Rbac,
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
      preMintReceiver: 'bob.near',
      mintable: false,
      burnable: false,
    }),
    plugins: [new Pause({}), new Rbac({ accountId: 'bob.near' })],
  }),
  () => ({
    token: new NonFungibleToken({
      name: 'My Non Fungible Token',
      symbol: 'MNFT',
      mintable: false,
      burnable: false,
    }),
    plugins: [],
  }),
  () => ({
    token: new NonFungibleToken({
      name: 'My Non Fungible Token',
      symbol: 'MNFT',
      mintable: true,
      burnable: true,
    }),
    plugins: [new Owner({})],
  }),
  () => ({
    token: new NonFungibleToken({
      name: 'My Non Fungible Token',
      symbol: 'MNFT',
      mintable: true,
      burnable: true,
    }),
    plugins: [new Pause({})],
  }),
  () => ({
    token: new NonFungibleToken({
      name: 'My Non Fungible Token',
      symbol: 'MNFT',
      mintable: true,
      burnable: false,
    }),
    plugins: [new Pause({}), new Rbac({})],
  }),
  () => ({
    token: new FungibleToken({
      name: 'My Fungible Token',
      symbol: 'MFT',
      decimals: 18,
      preMint: '0',
      mintable: false,
      burnable: true,
    }),
    plugins: [new Owner({ accountId: 'bob.near' })],
  }),
  () => ({
    token: new NonFungibleToken({
      name: 'My Non Fungible Token',
      symbol: 'MNFT',
      mintable: false,
      burnable: false,
    }),
    plugins: [new Rbac({})],
  }),
];

const srcDir = 'tests/src';
const filePath = path.join(srcDir, 'lib.rs');

fs.mkdirSync(srcDir, { recursive: true });

for (const test of tests) {
  const options = test();
  const code = generateCode(options);
  fs.writeFileSync(filePath, code, {
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
