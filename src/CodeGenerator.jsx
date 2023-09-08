const { message, onMessage } = props;

return (
  <iframe
    style={{ display: 'none' }}
    srcDoc={SRC_DOC}
    message={message}
    onMessage={onMessage}
  />
);
