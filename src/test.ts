import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { CodeGenerationOptionsPojo, generateCode } from './lib';

const testOptions: CodeGenerationOptionsPojo[] = [
  {
    token: {
      which: 'ft',
      config: {
        name: 'My Fungible Token',
        symbol: 'MFT',
        decimals: 24,
        preMint: '0',
        mintable: true,
        burnable: true,
      },
    },
    plugins: {},
  },
  {
    token: {
      which: 'ft',
      config: {
        name: 'My Fungible Token',
        symbol: 'MFT',
        decimals: 24,
        preMint: '1000',
        preMintReceiver: 'bob.near',
        mintable: false,
        burnable: false,
      },
    },
    plugins: {
      pause: {},
      rbac: {
        accountId: 'bob.near',
      },
    },
  },
  {
    token: {
      which: 'nft',
      config: {
        name: 'My Non Fungible Token',
        symbol: 'MNFT',
        mintable: false,
        burnable: false,
      },
    },
    plugins: {},
  },
  {
    token: {
      which: 'nft',
      config: {
        name: 'My Non Fungible Token',
        symbol: 'MNFT',
        mintable: true,
        burnable: true,
      },
    },
    plugins: {
      owner: {},
    },
  },
  {
    token: {
      which: 'nft',
      config: {
        name: 'My Non Fungible Token',
        symbol: 'MNFT',
        mintable: true,
        burnable: true,
      },
    },
    plugins: {
      pause: {},
    },
  },
  {
    token: {
      which: 'nft',
      config: {
        name: 'My Non Fungible Token',
        symbol: 'MNFT',
        mintable: true,
        burnable: false,
      },
    },
    plugins: {
      pause: {},
      owner: {},
    },
  },
  {
    token: {
      which: 'ft',
      config: {
        name: 'My Fungible Token',
        symbol: 'MFT',
        decimals: 18,
        preMint: '0',
        mintable: false,
        burnable: true,
      },
    },
    plugins: {
      rbac: {
        accountId: 'bob.near',
      },
    },
  },
  {
    token: {
      which: 'nft',
      config: {
        name: 'My Non Fungible Token',
        symbol: 'MNFT',
        mintable: false,
        burnable: false,
      },
    },
    plugins: {
      rbac: {},
    },
  },
  {
    token: {
      which: 'ft',
      config: {
        name: 'My Fungible Token',
        symbol: 'MFT',
        decimals: 24,
        preMint: '1220',
        preMintReceiver: 'bob.near',
        mintable: true,
        burnable: false,
      },
    },
    plugins: {
      rbac: {
        accountId: 'bob.near',
      },
    },
  },
];

// use to specify the indices of specific tests to run
const only: number[] = [];

const srcDir = 'tests/src';
const filePath = path.join(srcDir, 'lib.rs');

fs.mkdirSync(srcDir, { recursive: true });

const runTests =
  only.length === 0 ? testOptions : only.map((i) => testOptions[i]);

for (const options of runTests) {
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
