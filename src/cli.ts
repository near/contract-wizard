import {
  generateCode,
  NonFungibleToken,
  FungibleToken,
  Owner,
  Pause,
  ContractPlugin,
} from './index';

const [tokenString, ...pluginStrings] = process.argv.slice(2);

const [tokenType, tokenConfigString] = tokenString.split(/:(.*)/);
const tokenConfig = JSON.parse(tokenConfigString);

const token = (() => {
  switch (tokenType) {
    case 'ft':
      return new FungibleToken(tokenConfig);
    case 'nft':
      return new NonFungibleToken(tokenConfig);
    default:
      throw new Error(`Unknown token type: ${tokenType}`);
  }
})();

const plugins: ContractPlugin[] = [];

for (const pluginString of pluginStrings) {
  const [pluginName, pluginConfigString] = pluginString.split(/:(.*)/);
  const pluginConfig = JSON.parse(pluginConfigString);
  switch (pluginName) {
    case 'owner':
      plugins.push(new Owner(pluginConfig));
      break;
    case 'pause':
      plugins.push(new Pause(pluginConfig));
      break;
    default:
      throw new Error(`Unknown plugin: ${pluginName}`);
  }
}

const code = generateCode({
  token,
  plugins,
});

console.log(code);
