function indent(n: number): (s: string) => string {
  return (s: string) =>
    s
      .split('\n')
      .map((line) => (line.length ? '    '.repeat(n) + line : ''))
      .join('\n');
}

export interface Import {
  path: string[];
}

export interface Guards {
  beforeChangeFunction: string[];
  afterChangeFunction: string[];
  beforeAuthorizedFunction: string[];
}

export interface TokenCodeFragments {
  imports: Import[];
  deriveMacroName?: string;
  deriveMacroAttribute?: string;
  constructorCode?: string;
  bindgenCode?: string;
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
      decimals: number | string;
      preMint?: string;
      preMintReceiver?: string;
      mintable?: boolean;
      burnable?: boolean;
    },
  ) {}

  generate(guards: Guards): TokenCodeFragments {
    const imports = [
      { path: ['near_sdk_contract_tools', 'FungibleToken'] },
      { path: ['near_sdk_contract_tools', 'standard', 'nep141', '*'] },
    ];

    let constructorCode = undefined;

    const preMint =
      this.config.preMint && +this.config.preMint > 0
        ? (this.config.preMint + '').trim()
        : undefined;

    if (preMint !== undefined) {
      imports.push({ path: ['near_sdk', 'env'] });

      const preMintReceiver = this.config.preMintReceiver
        ? `"${this.config.preMintReceiver}".parse().unwrap()`
        : 'env::predecessor_account_id()';
      constructorCode = `contract.mint(${preMintReceiver}, ${this.config.preMint}u128, None);`;
    }

    const decimalsValue =
      'decimals' in this.config ? +this.config.decimals : 24;
    const decimals = Math.max(0, Math.min(38, decimalsValue));

    const attributes = [
      `name = "${this.config.name}"`,
      `symbol = "${this.config.symbol}"`,
      `decimals = ${decimals}`,
    ];

    const bindgenCodes = [];
    const beforeChangeFunctionCode = guards.beforeChangeFunction.length
      ? '\n' + guards.beforeChangeFunction.map(indent(1)).join('\n')
      : '';
    const afterChangeFunctionCode = guards.afterChangeFunction.length
      ? '\n' + guards.afterChangeFunction.map(indent(1)).join('\n')
      : '';
    const beforeAuthorizedFunction = guards.beforeAuthorizedFunction.length
      ? '\n' + indent(1)(guards.beforeAuthorizedFunction.join('\n'))
      : '';

    if (this.config.mintable) {
      imports.push({ path: ['near_sdk', 'AccountId'] });
      imports.push({ path: ['near_sdk', 'json_types', 'U128'] });
      const code = `
pub fn mint(&mut self, account_id: AccountId, amount: U128) {${beforeChangeFunctionCode}${beforeAuthorizedFunction}
    Nep141Controller::mint(self, account_id, amount.into(), None);${afterChangeFunctionCode}
}
`.trim();
      bindgenCodes.push(code);
    }

    if (this.config.burnable) {
      imports.push({ path: ['near_sdk', 'env'] });
      imports.push({ path: ['near_sdk', 'json_types', 'U128'] });
      const code = `
pub fn burn(&mut self, amount: U128) {${beforeChangeFunctionCode}
    Nep141Controller::burn(self, env::predecessor_account_id(), amount.into(), None);${afterChangeFunctionCode}
}
`.trim();
      bindgenCodes.push(code);
    }

    const bindgenCode = bindgenCodes.join('\n\n') || undefined;

    let otherCode = undefined;

    if (
      guards.afterChangeFunction.length == 0 &&
      guards.beforeChangeFunction.length == 0
    ) {
      attributes.push('no_hooks');
    } else {
      otherCode = `
impl Nep141Hook for Contract {
    fn before_transfer(&mut self, transfer: &Nep141Transfer) {${indent(1)(
      beforeChangeFunctionCode,
    )}
    }

    fn after_transfer(&mut self, transfer: &Nep141Transfer, _: ()) {${indent(1)(
      afterChangeFunctionCode,
    )}
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
      bindgenCode,
      otherCode,
    };
  }
}

export class NonFungibleToken implements Token {
  constructor(
    public config: {
      name: string;
      symbol: string;
      baseUri?: string;
      mintable?: boolean;
      burnable?: boolean;
    },
  ) {}

  generate(guards: Guards): TokenCodeFragments {
    const imports = [{ path: ['near_sdk_contract_tools', 'nft', '*'] }];

    const constructorCode = `
contract.set_contract_metadata(ContractMetadata::new(
    "${this.config.name}".to_string(),
    "${this.config.symbol}".to_string(),
    ${
      this.config.baseUri
        ? `Some("${this.config.baseUri}".to_string())`
        : 'None'
    },
));
`.trim();

    const attributes = [];

    let otherCode = undefined;

    const beforeChangeFunctionCode = guards.beforeChangeFunction.length
      ? '\n' + guards.beforeChangeFunction.map(indent(1)).join('\n')
      : '';
    const afterChangeFunctionCode = guards.afterChangeFunction.length
      ? '\n' + guards.afterChangeFunction.map(indent(1)).join('\n')
      : '';
    const beforeAuthorizedFunction = guards.beforeAuthorizedFunction.length
      ? '\n' + indent(1)(guards.beforeAuthorizedFunction.join('\n'))
      : '';

    if (
      guards.afterChangeFunction.length == 0 &&
      guards.beforeChangeFunction.length == 0 &&
      guards.beforeAuthorizedFunction.length == 0
    ) {
      attributes.push('no_core_hooks', 'no_approval_hooks');
    } else {
      imports.push({ path: ['near_sdk', 'AccountId'] });

      let nep178HookCode = [
        beforeChangeFunctionCode.length > 0
          ? `
fn before_nft_approve(&self, token_id: &TokenId, account_id: &AccountId) {${beforeChangeFunctionCode}
}

fn before_nft_revoke(&self, token_id: &TokenId, account_id: &AccountId) {${beforeChangeFunctionCode}
}

fn before_nft_revoke_all(&self, token_id: &TokenId) {${beforeChangeFunctionCode}
}
`.trim()
          : '',
        afterChangeFunctionCode.length > 0
          ? `
fn after_nft_approve(&mut self, token_id: &TokenId, account_id: &AccountId, _approval_id: &ApprovalId) {${afterChangeFunctionCode}
}

fn after_nft_revoke(&mut self, token_id: &TokenId, account_id: &AccountId) {${afterChangeFunctionCode}
}

fn after_nft_revoke_all(&mut self, token_id: &TokenId) {${afterChangeFunctionCode}
}
`.trim()
          : '',
      ]
        .filter((x) => x.length > 0)
        .map(indent(1))
        .join('\n\n');

      if (nep178HookCode.length == 0) {
        attributes.push('no_approval_hooks');
      } else {
        nep178HookCode = `
impl SimpleNep178Hook for Contract {
${nep178HookCode}
}
`.trim();
      }

      let nep171HookCode = [
        beforeChangeFunctionCode.length > 0
          ? `fn before_nft_transfer(&self, transfer: &Nep171Transfer) {${beforeChangeFunctionCode}
}`
          : '',
        afterChangeFunctionCode.length > 0
          ? `fn after_nft_transfer(&self, transfer: &Nep171Transfer) {${afterChangeFunctionCode}
}`
          : '',
      ]
        .filter((x) => x.length > 0)
        .map(indent(1))
        .join('\n\n');

      if (nep171HookCode.length == 0) {
        attributes.push('no_core_hooks');
      } else {
        nep171HookCode = `
impl SimpleNep171Hook for Contract {
${nep171HookCode}
}
`.trim();
      }

      otherCode = [nep178HookCode, nep171HookCode]
        .filter((x) => x.length > 0)
        .join('\n\n');
    }

    const bindgenCodes = [];

    if (this.config.mintable) {
      imports.push({ path: ['near_sdk', 'AccountId'] });
      imports.push({ path: ['near_sdk', 'env'] });
      const code = `
pub fn mint(&mut self, token_id: TokenId, account_id: AccountId, metadata: TokenMetadata) {${beforeAuthorizedFunction}${beforeChangeFunctionCode}
    Nep177Controller::mint_with_metadata(self, token_id, account_id, metadata)
        .unwrap_or_else(|e| env::panic_str(&e.to_string()));${afterChangeFunctionCode}
}
`.trim();
      bindgenCodes.push(code);
    }

    if (this.config.burnable) {
      imports.push({ path: ['near_sdk', 'env'] });
      const code = `
pub fn burn(&mut self, token_id: TokenId) {${beforeChangeFunctionCode}
    Nep177Controller::burn_with_metadata(self, token_id, &env::predecessor_account_id())
        .unwrap_or_else(|e| env::panic_str(&e.to_string()));${afterChangeFunctionCode}
}
`.trim();
      bindgenCodes.push(code);
    }

    const bindgenCode = bindgenCodes.join('\n\n') || undefined;

    const deriveMacroAttribute =
      attributes.length > 0
        ? `#[non_fungible_token(${attributes.join(', ')})]`
        : undefined;

    return {
      imports,
      deriveMacroName: 'NonFungibleToken',
      deriveMacroAttribute,
      constructorCode,
      bindgenCode,
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
  otherCode?: string;
  beforeChangeFunctionGuards: string[];
  afterChangeFunctionGuards: string[];
  authorizedFunctionGuards: string[];
}

export class Rbac implements ContractPlugin {
  constructor(
    public config: {
      accountId?: string;
    },
  ) {}

  generate(): PluginCodeFragments {
    const imports = [
      { path: ['near_sdk', 'borsh', 'self'] },
      { path: ['near_sdk', 'borsh', 'BorshSerialize'] },
      { path: ['near_sdk', 'BorshStorageKey'] },
      { path: ['near_sdk_contract_tools', 'Rbac'] },
      { path: ['near_sdk_contract_tools', 'rbac', '*'] },
    ];

    const accountId = this.config.accountId
      ? `"${this.config.accountId}".parse().unwrap()`
      : 'env::predecessor_account_id()';

    return {
      imports,
      deriveMacroName: 'Rbac',
      deriveMacroAttribute: `#[rbac(roles = "Role")]`,
      beforeChangeFunctionGuards: [],
      afterChangeFunctionGuards: [],
      authorizedFunctionGuards: ['<Self as Rbac>::require_role(&Role::Admin);'],
      constructorCode: `contract.add_role(${accountId}, &Role::Admin);`,
      otherCode: `
#[derive(BorshSerialize, BorshStorageKey)]
pub enum Role {
    Admin,
}
`.trim(),
    };
  }
}

export class Owner implements ContractPlugin {
  constructor(
    public config: {
      accountId?: string;
    },
  ) {}

  generate(): PluginCodeFragments {
    const imports = [
      { path: ['near_sdk', 'env'] },
      { path: ['near_sdk_contract_tools', 'Owner'] },
      { path: ['near_sdk_contract_tools', 'owner', '*'] },
    ];

    const accountId = this.config.accountId
      ? `"${this.config.accountId}".parse().unwrap()`
      : 'env::predecessor_account_id()';

    const constructorCode = `Owner::init(&mut contract, &${accountId});`;

    return {
      imports,
      deriveMacroName: 'Owner',
      constructorCode,
      beforeChangeFunctionGuards: [],
      afterChangeFunctionGuards: [],
      authorizedFunctionGuards: ['<Self as Owner>::require_owner();'],
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
      authorizedFunctionGuards: [],
    };
  }
}

export interface CodeGenerationOptions {
  token: Token;
  plugins: ContractPlugin[];
}

export interface CodeGenerationOptionsPojo {
  token:
    | {
        which: 'ft';
        config: ConstructorParameters<typeof FungibleToken>[0];
      }
    | {
        which: 'nft';
        config: ConstructorParameters<typeof NonFungibleToken>[0];
      };
  plugins: {
    owner?: {};
    pause?: {};
    rbac?: {};
  };
}

function isPojoConfig(x: any): x is CodeGenerationOptionsPojo {
  return (
    x &&
    typeof x === 'object' &&
    typeof x.token === 'object' &&
    typeof x.token.which === 'string'
  );
}

function pojoToConfig(pojo: CodeGenerationOptionsPojo): CodeGenerationOptions {
  const token =
    pojo.token.which === 'ft'
      ? new FungibleToken(pojo.token.config)
      : new NonFungibleToken(pojo.token.config);

  const plugins = Object.entries(pojo.plugins).map(([pluginId, config]) => {
    switch (pluginId) {
      case 'owner':
        return new Owner(config);
      case 'pause':
        return new Pause(config);
      case 'rbac':
        return new Rbac(config);
      default:
        throw new Error(`Unknown plugin: "${pluginId}"`);
    }
  });

  return {
    token,
    plugins,
  };
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

export function generateCode(
  options: CodeGenerationOptions | CodeGenerationOptionsPojo,
): string {
  let useOptions;
  if (isPojoConfig(options)) {
    useOptions = pojoToConfig(options);
  } else {
    useOptions = options;
  }

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
    beforeAuthorizedFunction: [],
  };

  const deriveMacroNames = [
    'BorshSerialize',
    'BorshDeserialize',
    'PanicOnDefault',
  ];
  const deriveMacroAttributes = [];
  const constructorCodes = [];
  const otherCodes = [];

  Object.values(useOptions.plugins).forEach((plugin) => {
    const pluginCodeFragments = plugin.generate();
    imports.push(...pluginCodeFragments.imports);
    guards.beforeChangeFunction.push(
      ...pluginCodeFragments.beforeChangeFunctionGuards,
    );
    guards.afterChangeFunction.push(
      ...pluginCodeFragments.afterChangeFunctionGuards,
    );
    guards.beforeAuthorizedFunction.push(
      ...pluginCodeFragments.authorizedFunctionGuards,
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
    if (pluginCodeFragments.otherCode) {
      otherCodes.push(pluginCodeFragments.otherCode);
    }
  });

  const tokenCodeFragments = useOptions.token.generate(guards);

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
  if (tokenCodeFragments.otherCode) {
    otherCodes.push(tokenCodeFragments.otherCode);
  }

  deriveMacroAttributes.push('#[near_bindgen]');

  let constructorCode = '\nSelf {}';
  if (constructorCodes.length > 0) {
    constructorCode = `
let mut contract = Self {};

${constructorCodes.join('\n')}

contract`;
  }

  let bindgenCode = '';
  if (tokenCodeFragments.bindgenCode) {
    bindgenCode = `

${tokenCodeFragments.bindgenCode}`;
  }

  return (
    `
${resolveImports(imports)}

#[derive(${deriveMacroNames.join(', ')})]
${deriveMacroAttributes.join('\n')}
pub struct Contract {}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {${indent(2)(constructorCode)}
    }${indent(1)(bindgenCode)}
}

${otherCodes.join('\n\n')}
`.trim() + '\n'
  );
}
