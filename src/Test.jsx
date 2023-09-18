State.init({
  msg: '',
});

return (
  <>
    <h2>Contract Generator</h2>
    <pre>{state.msg}</pre>
    <Widget
      src="${REPL_ACCOUNT}/widget/CodeGenerator"
      props={{
        message: {
          token: {
            which: 'ft',
            config: {
              name: 'MyToken',
              symbol: 'MYT',
              decimals: 24,
              preMint: '1000000000000000000000000',
              mintable: true,
              burnable: true,
            },
          },
          plugins: {
            // owner: {},
            pause: {},
            rbac: { accountId: 'bob.near' },
          },
        },
        onMessage: (e) => {
          State.update({ msg: e });
        },
      }}
    />
  </>
);
