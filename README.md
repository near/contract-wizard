# NEAR Contract Wizard

## Setup

1. Install dependencies: `npm install`.
2. Run `npm run prepare` to install commit hooks.
3. Run `npm run build` to build the project.

## Testing

Run `npm run test` to run the tests.

The tests work by generating the Rust code, writing it to `tests/src/lib.rs`, and then trying to compile it to WASM. Compilation failure = test failure.

For this to work, you have to have the Rust build tools installed, as well as the `wasm32-unknown-unknown` target. You can install the WASM target with:

```bash
rustup target add wasm32-unknown-unknown
```

## Authors

- Jacob Lindahl <jacob.lindahl@near.org> [@sudo_build](https://twitter.com/sudo_build)
