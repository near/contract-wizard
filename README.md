# NEAR Contract Wizard

## Setup

1. Install dependencies: `npm install`.
2. Run `npm run prepare` to install commit hooks.
3. Run `npm run build` to build the project.

## Generating code using the CLI

There's a simple CLI script `src/cli.ts` that you can use to try out the code generation.

```bash
npm run -s cli 'ft:{"name":"My Fungible Token","symbol":"MFT","decimals":24,"preMint":10}' > my_ft_contract.rs
```

## Testing

Run `npm run test` to run the tests.

The tests work by generating the Rust code, writing it to `tests/src/lib.rs`, and then trying to compile it to WASM. Compilation failure = test failure.

For this to work, you have to have the Rust build tools installed, as well as the `wasm32-unknown-unknown` target. You can install the WASM target with:

```bash
rustup target add wasm32-unknown-unknown
```

## Authors

- Jacob Lindahl <jacob.lindahl@near.org> [@sudo_build](https://twitter.com/sudo_build)
