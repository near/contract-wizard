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
            },
          },
          plugins: ['owner', 'pause'],
        },
        onMessage: (e) => {
          State.update({ msg: e });
        },
      }}
    />
  </>
);
