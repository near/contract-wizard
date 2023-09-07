function indent(n: number): (s: string) => string {
  return (s: string) =>
    s
      .split('\n')
      .map((line) => '    '.repeat(n) + line)
      .join('\n');
}

export interface Import {
  path: string[];
}

export interface Guards {
  beforeChangeFunction: string[];
  afterChangeFunction: string[];
}

export interface TokenCodeFragments {
  imports: Import[];
  deriveMacroName?: string;
  deriveMacroAttribute?: string;
  constructorCode?: string;
  otherCode?: string;
}

export interface Token {
  generate(guards: Guards): TokenCodeFragments;
}

export class FungibleToken implements Token {
  constructor(
    public config: {
      name: string;
      symbol: string;
      decimals: number;
      preMint: number;
    },
  ) {}

  generate(guards: Guards): TokenCodeFragments {
    const imports = [
      { path: ['near_sdk_contract_tools', 'FungibleToken'] },
      { path: ['near_sdk_contract_tools', 'standard', 'nep141', '*'] },
    ];

    let constructorCode = undefined;

    if (this.config.preMint > 0) {
      imports.push({ path: ['near_sdk', 'env'] });
      constructorCode = `contract.deposit_unchecked(&env::predecessor_account_id(), ${this.config.preMint}u128);`;
    }

    const attributes = [
      `name = "${this.config.name}"`,
      `symbol = "${this.config.symbol}"`,
      `decimals = ${this.config.decimals}`,
    ];

    let otherCode = undefined;

    if (
      guards.afterChangeFunction.length == 0 &&
      guards.beforeChangeFunction.length == 0
    ) {
      attributes.push('no_hooks');
    } else {
      otherCode = `
impl Nep141Hook for Contract {
    fn before_transfer(&mut self, transfer: &Nep141Transfer) {
${guards.beforeChangeFunction.map(indent(2)).join('\n')}
    }

    fn after_transfer(&mut self, transfer: &Nep141Transfer, _: ()) {
${guards.afterChangeFunction.map(indent(2)).join('\n')}
    }
}
`.trim();
    }

    const deriveMacroAttribute = `#[fungible_token(${attributes.join(', ')})]`;

    return {
      imports,
      deriveMacroName: 'FungibleToken',
      deriveMacroAttribute,
      constructorCode,
      otherCode,
    };
  }
}

export class NonFungibleToken implements Token {
  constructor(
    public config: {
      name: string;
      symbol: string;
    },
  ) {}

  generate(guards: Guards): TokenCodeFragments {
    const imports = [
      { path: ['near_sdk', 'AccountId'] },
      { path: ['near_sdk_contract_tools', 'NonFungibleToken'] },
      { path: ['near_sdk_contract_tools', 'standard', 'nep171', '*'] },
      { path: ['near_sdk_contract_tools', 'standard', 'nep177', '*'] },
      { path: ['near_sdk_contract_tools', 'standard', 'nep178', '*'] },
    ];

    const constructorCode = `
contract.set_contract_metadata(ContractMetadata::new(
    "${this.config.name}".to_string(),
    "${this.config.symbol}".to_string(),
    None,
));
`.trim();

    const attributes = [];

    let otherCode = undefined;

    if (
      guards.afterChangeFunction.length == 0 &&
      guards.beforeChangeFunction.length == 0
    ) {
      attributes.push('no_hooks');
    } else {
      otherCode = `
impl Nep178Hook for Contract {
    fn before_nft_approve(&self, token_id: &TokenId, account_id: &AccountId) {
${guards.beforeChangeFunction.map(indent(2)).join('\n')}
    }

    fn after_nft_approve(&mut self, token_id: &TokenId, account_id: &AccountId, _approval_id: &ApprovalId, _: ()) {
${guards.afterChangeFunction.map(indent(2)).join('\n')}
    }

    fn before_nft_revoke(&self, token_id: &TokenId, account_id: &AccountId) {
${guards.beforeChangeFunction.map(indent(2)).join('\n')}
    }

    fn after_nft_revoke(&mut self, token_id: &TokenId, account_id: &AccountId, _: ()) {
${guards.afterChangeFunction.map(indent(2)).join('\n')}
    }

    fn before_nft_revoke_all(&self, token_id: &TokenId) {
${guards.beforeChangeFunction.map(indent(2)).join('\n')}
    }

    fn after_nft_revoke_all(&mut self, token_id: &TokenId, _: ()) {
${guards.afterChangeFunction.map(indent(2)).join('\n')}
    }
}

impl Nep171Hook for Contract {
    fn before_nft_transfer(contract: &Self, transfer: &Nep171Transfer) {
${guards.beforeChangeFunction.map(indent(2)).join('\n')}
    }

    fn after_nft_transfer(contract: &mut Self, transfer: &Nep171Transfer, _: ()) {
${guards.afterChangeFunction.map(indent(2)).join('\n')}
    }
}
`.trim();
    }

    const deriveMacroAttribute = `#[non_fungible_token(${attributes.join(
      ', ',
    )})]`;

    return {
      imports,
      deriveMacroName: 'NonFungibleToken',
      deriveMacroAttribute,
      constructorCode,
      otherCode,
    };
  }
}

export interface ContractPlugin {
  generate(): PluginCodeFragments;
}

export interface PluginCodeFragments {
  imports: Import[];
  deriveMacroName?: string;
  deriveMacroAttribute?: string;
  constructorCode?: string;
  beforeChangeFunctionGuards: string[];
  afterChangeFunctionGuards: string[];
}

export class Owner implements ContractPlugin {
  constructor(_config: {}) {}

  generate(): PluginCodeFragments {
    const imports = [
      { path: ['near_sdk', 'env'] },
      { path: ['near_sdk_contract_tools', 'Owner'] },
      { path: ['near_sdk_contract_tools', 'owner', '*'] },
    ];

    const constructorCode =
      'Owner::init(&mut contract, &env::predecessor_account_id());';

    return {
      imports,
      deriveMacroName: 'Owner',
      constructorCode,
      beforeChangeFunctionGuards: [],
      afterChangeFunctionGuards: [],
    };
  }
}

export class Pause implements ContractPlugin {
  constructor(_config: {}) {}

  generate(): PluginCodeFragments {
    const imports = [
      { path: ['near_sdk_contract_tools', 'Pause'] },
      { path: ['near_sdk_contract_tools', 'pause', '*'] },
    ];

    return {
      imports,
      deriveMacroName: 'Pause',
      beforeChangeFunctionGuards: ['Contract::require_unpaused();'],
      afterChangeFunctionGuards: [],
    };
  }
}

export interface CodeGenerationOptions {
  token: Token;
  plugins: ContractPlugin[];
}

interface ImportNode {
  part: string;
  children: {
    [part: string]: ImportNode;
  };
}

function resolveImports(imports: Import[]): string {
  const roots: ImportNode = {
    part: '',
    children: {},
  };

  function addPath(root: ImportNode, path: string[]) {
    if (path.length == 0) {
      return;
    }

    const [part, ...rest] = path;

    if (root.children[part] == undefined) {
      root.children[part] = {
        part,
        children: {},
      };
    }

    addPath(root.children[part], rest);
  }

  for (const i of imports) {
    addPath(roots, i.path);
  }

  function generateImportCode(root: ImportNode): string {
    const childNodes = Object.values(root.children);
    if (childNodes.length === 1) {
      return `${root.part}::${generateImportCode(childNodes[0])}`;
    } else if (childNodes.length > 1) {
      const childCode = childNodes
        .map(generateImportCode)
        .map(indent(1))
        .join(',\n');
      return `${root.part}::{
${childCode},
}`;
    } else {
      return root.part;
    }
  }

  return Object.values(roots.children)
    .map((child) => `use ${generateImportCode(child)};`)
    .join('\n');
}

export function generateCode(options: CodeGenerationOptions): string {
  const imports = [
    { path: ['near_sdk', 'near_bindgen'] },
    { path: ['near_sdk', 'PanicOnDefault'] },
    { path: ['near_sdk', 'borsh', 'self'] },
    { path: ['near_sdk', 'borsh', 'BorshSerialize'] },
    { path: ['near_sdk', 'borsh', 'BorshDeserialize'] },
  ];

  const guards: Guards = {
    beforeChangeFunction: [],
    afterChangeFunction: [],
  };

  const deriveMacroNames = [
    'BorshSerialize',
    'BorshDeserialize',
    'PanicOnDefault',
  ];
  const deriveMacroAttributes = [];
  const constructorCodes = [];

  Object.values(options.plugins).forEach((plugin) => {
    const pluginCodeFragments = plugin.generate();
    imports.push(...pluginCodeFragments.imports);
    guards.beforeChangeFunction.push(
      ...pluginCodeFragments.beforeChangeFunctionGuards,
    );
    guards.afterChangeFunction.push(
      ...pluginCodeFragments.afterChangeFunctionGuards,
    );
    if (pluginCodeFragments.constructorCode) {
      constructorCodes.push(pluginCodeFragments.constructorCode);
    }
    if (pluginCodeFragments.deriveMacroName) {
      deriveMacroNames.push(pluginCodeFragments.deriveMacroName);
    }
    if (pluginCodeFragments.deriveMacroAttribute) {
      deriveMacroAttributes.push(pluginCodeFragments.deriveMacroAttribute);
    }
  });

  const tokenCodeFragments = options.token.generate(guards);

  imports.push(...tokenCodeFragments.imports);
  if (tokenCodeFragments.deriveMacroName) {
    deriveMacroNames.push(tokenCodeFragments.deriveMacroName);
  }
  if (tokenCodeFragments.deriveMacroAttribute) {
    deriveMacroAttributes.push(tokenCodeFragments.deriveMacroAttribute);
  }
  if (tokenCodeFragments.constructorCode) {
    constructorCodes.push(tokenCodeFragments.constructorCode);
  }

  deriveMacroAttributes.push('#[near_bindgen]');

  let constructorCode = 'Self {}';
  if (constructorCodes.length > 0) {
    constructorCode = `
let mut contract = Self {};

${constructorCodes.join('\n')}

contract
`.trim();
  }

  return `
${resolveImports(imports)}

#[derive(${deriveMacroNames.join(', ')})]
${deriveMacroAttributes.join('\n')}
pub struct Contract {}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
${indent(2)(constructorCode)}
    }
}

${tokenCodeFragments.otherCode ? tokenCodeFragments.otherCode : ''}
`.trim();
}
