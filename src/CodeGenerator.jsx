// const { message, onMessage } = props;

State.init({
  msg: '',
});

const Hidden = styled.div`
  display: none;
`;

return (
  <>
    <pre>message: {state.msg}</pre>
    <Hidden>
      <iframe
        srcDoc={SRCDOC}
        message={{
          token: {
            which: 'ft',
            config: {
              name: 'MyToken',
              symbol: 'MYT',
              decimals: 24,
              preMint: '1000000000000000000000000',
            },
          },
          plugins: [],
        }}
        onMessage={(e) => {
          State.update({ msg: e });
        }}
      />
    </Hidden>
  </>
);
