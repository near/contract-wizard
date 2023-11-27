function makeValidAccountId(s: string): string {
  const clean = (s: string) =>
    s
      .split('.')
      .map((p) => p.replace(/[^a-z0-9_-]/g, ''))
      .filter((p) => p.length > 0)
      .join('.');
  const cleaned = clean(s);

  if (cleaned.length > 64) {
    return clean(cleaned.substring(0, 64));
  } else if (cleaned.length < 2) {
    return clean(cleaned + '.near');
  } else {
    return cleaned;
  }
}

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

export interface TokenCodeFragments {
  imports: Import[];
  deriveMacroName?: string;
  deriveMacroAttribute?: string;
  constructorCode?: string;
  bindgenCode?: string;
  otherCode?: string;
}

export interface Hooks {
  all: string[];
  authorized: string[];
}

function hooksToCons(hooks: string[]): string {
  if (hooks.length === 0) {
    return '()';
  } else if (hooks.length === 1) {
    return hooks[0];
  } else {
    const hook = hooks[0];
    const tail = hooks.slice(1);
    return `(${hook}, ${hooksToCons(tail)})`;
  }
}

export interface Token {
  generate(hooks: Hooks): TokenCodeFragments;
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

  generate(hooks: Hooks): TokenCodeFragments {
    const imports = [
      { path: ['near_sdk_contract_tools', 'ft', '*'] },
      { path: ['near_sdk', 'env'] },
    ];

    const decimalsValue =
      'decimals' in this.config ? +this.config.decimals : 24;
    const decimals = Math.max(0, Math.min(38, decimalsValue));

    let constructorCodes = [
      `
Nep148Controller::set_metadata(
    &mut contract,
    &FungibleTokenMetadata::new("${this.config.name}".to_string(), "${this.config.symbol}".to_string(), ${decimals}),
);
`.trim(),
    ];

    const preMint =
      this.config.preMint && +this.config.preMint > 0
        ? (this.config.preMint + '').trim()
        : undefined;

    if (preMint !== undefined) {
      let preMintReceiver;

      if (this.config.preMintReceiver) {
        preMintReceiver = `"${makeValidAccountId(
          this.config.preMintReceiver,
        )}".parse().unwrap()`;
      } else {
        preMintReceiver = 'env::predecessor_account_id()';
      }

      constructorCodes.push(
        `
Nep141Controller::mint(
    &mut contract,
    &Nep141Mint {
        amount: ${preMint}u128,
        receiver_id: &${preMintReceiver},
        memo: None,
    },
)
.unwrap_or_else(|e| env::panic_str(&e.to_string()));
`.trim(),
      );
    }

    const bindgenCodes = [];

    if (this.config.mintable) {
      imports.push({ path: ['near_sdk', 'AccountId'] });
      imports.push({ path: ['near_sdk', 'env'] });
      imports.push({ path: ['near_sdk', 'json_types', 'U128'] });
      const code = `
pub fn mint(&mut self, account_id: AccountId, amount: U128) {
    Nep141Controller::mint(
        self,
        &Nep141Mint {
            amount: amount.into(),
            receiver_id: &account_id,
            memo: None,
        },
    )
    .unwrap_or_else(|e| env::panic_str(&e.to_string()));
}
`.trim();
      bindgenCodes.push(code);
    }

    if (this.config.burnable) {
      imports.push({ path: ['near_sdk', 'env'] });
      imports.push({ path: ['near_sdk', 'json_types', 'U128'] });
      const code = `
pub fn burn(&mut self, amount: U128) {
    Nep141Controller::burn(
        self,
        &Nep141Burn {
            amount: amount.into(),
            owner_id: &env::predecessor_account_id(),
            memo: None,
        },
    )
    .unwrap_or_else(|e| env::panic_str(&e.to_string()));
}
`.trim();
      bindgenCodes.push(code);
    }

    const bindgenCode = bindgenCodes.join('\n\n') || undefined;

    const attributes = [];

    if (hooks.all.length !== 0) {
      attributes.push(`all_hooks = "${hooksToCons(hooks.all)}"`);
    }

    if (hooks.authorized.length !== 0) {
      attributes.push(`mint_hook = "${hooksToCons(hooks.authorized)}"`);
    }

    const deriveMacroAttribute =
      attributes.length > 0
        ? `#[fungible_token(${attributes.join(', ')})]`
        : undefined;

    return {
      imports,
      deriveMacroName: 'FungibleToken',
      deriveMacroAttribute,
      constructorCode: constructorCodes.join('\n\n'),
      bindgenCode,
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

  generate(hooks: Hooks): TokenCodeFragments {
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

    let otherCode = undefined;

    const bindgenCodes = [];

    if (this.config.mintable) {
      imports.push({ path: ['near_sdk', 'AccountId'] });
      imports.push({ path: ['near_sdk', 'env'] });
      const code = `
pub fn mint(&mut self, token_id: TokenId, account_id: AccountId, metadata: TokenMetadata) {
    Nep177Controller::mint_with_metadata(self, token_id, account_id, metadata)
        .unwrap_or_else(|e| env::panic_str(&e.to_string()));
}
    `.trim();
      bindgenCodes.push(code);
    }

    if (this.config.burnable) {
      imports.push({ path: ['near_sdk', 'env'] });
      const code = `
pub fn burn(&mut self, token_id: TokenId) {
    Nep177Controller::burn_with_metadata(self, token_id, &env::predecessor_account_id())
        .unwrap_or_else(|e| env::panic_str(&e.to_string()));
}
    `.trim();
      bindgenCodes.push(code);
    }

    const bindgenCode = bindgenCodes.join('\n\n') || undefined;

    const attributes = [];

    if (hooks.all.length !== 0) {
      attributes.push(`all_hooks = "${hooksToCons(hooks.all)}"`);
    }

    if (hooks.authorized.length !== 0) {
      attributes.push(`mint_hook = "${hooksToCons(hooks.authorized)}"`);
    }

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
  hooks: Hooks;
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
      { path: ['near_sdk_contract_tools', 'hook', 'Hook'] },
    ];

    let accountId;

    if (this.config.accountId) {
      accountId = `"${makeValidAccountId(
        this.config.accountId,
      )}".parse().unwrap()`;
    } else {
      imports.push({ path: ['near_sdk', 'env'] });
      accountId = 'env::predecessor_account_id()';
    }

    return {
      imports,
      deriveMacroName: 'Rbac',
      deriveMacroAttribute: `#[rbac(roles = "Role")]`,
      hooks: {
        all: [],
        authorized: ['OnlyAdmin'],
      },
      constructorCode: `contract.add_role(${accountId}, &Role::Admin);`,
      otherCode: `
#[derive(BorshSerialize, BorshStorageKey)]
pub enum Role {
    Admin,
}

pub struct OnlyAdmin;

impl<A> Hook<Contract, A> for OnlyAdmin {
    fn hook<R>(contract: &mut Contract, _args: &A, f: impl FnOnce(&mut Contract) -> R) -> R {
        <Contract as Rbac>::require_role(&Role::Admin);
        f(contract)
    }
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
      { path: ['near_sdk_contract_tools', 'Owner'] },
      { path: ['near_sdk_contract_tools', 'owner', '*'] },
      { path: ['near_sdk_contract_tools', 'owner', 'hooks', 'OnlyOwner'] },
    ];

    if (!this.config.accountId) {
      imports.push({ path: ['near_sdk', 'env'] });
    }

    const accountId = this.config.accountId
      ? `"${makeValidAccountId(this.config.accountId)}".parse().unwrap()`
      : 'env::predecessor_account_id()';

    const constructorCode = `Owner::init(&mut contract, &${accountId});`;

    return {
      imports,
      deriveMacroName: 'Owner',
      constructorCode,
      hooks: {
        all: [],
        authorized: ['OnlyOwner'],
      },
    };
  }
}

export class Pause implements ContractPlugin {
  constructor(_config: {}) {}

  generate(): PluginCodeFragments {
    const imports = [
      { path: ['near_sdk_contract_tools', 'Pause'] },
      { path: ['near_sdk_contract_tools', 'pause', '*'] },
      { path: ['near_sdk_contract_tools', 'pause', 'hooks', 'PausableHook'] },
    ];

    return {
      imports,
      deriveMacroName: 'Pause',
      hooks: {
        all: ['PausableHook'],
        authorized: [],
      },
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

  function generateImportCode(root: ImportNode, maxCols = 80): string {
    const childNodes = Object.values(root.children);
    const prefix = `${root.part}::`;
    if (childNodes.length === 1) {
      return `${prefix}${generateImportCode(
        childNodes[0],
        maxCols - prefix.length,
      )}`;
    } else if (childNodes.length > 1) {
      const childCodes = childNodes.map((childNode) =>
        generateImportCode(childNode, maxCols - prefix.length),
      );

      childCodes.sort();

      // first line doesn't have an indent applied
      const lines = [childCodes.shift()!];

      while (childCodes.length > 0) {
        const nextCode = childCodes.shift()!;
        if (nextCode.includes('\n')) {
          lines.push(indent(1)(nextCode));
          continue;
        }
        const nextLine = lines[lines.length - 1] + ', ' + nextCode;
        if (nextLine.length > maxCols) {
          lines.push(indent(1)(nextCode));
        } else {
          lines[lines.length - 1] = nextLine;
        }
      }

      if (lines.length === 1) {
        const line = lines[0];
        const singleLine = `${prefix}{${line}}`;
        if (singleLine.length <= maxCols) {
          return singleLine;
        } else {
          return `${prefix}{\n${indent(1)(line)}\n}`;
        }
      }

      // apply indent to first line
      lines[0] = indent(1)(lines[0]);

      const childCode = lines.join(',\n');
      return `${prefix}{
${childCode},
}`;
    } else {
      return root.part;
    }
  }

  return Object.values(roots.children)
    .map((child) => `use ${generateImportCode(child, 75)};`)
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

  const hooks: Hooks = {
    all: [],
    authorized: [],
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
    hooks.all.push(...pluginCodeFragments.hooks.all);
    hooks.authorized.push(...pluginCodeFragments.hooks.authorized);
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

  const tokenCodeFragments = useOptions.token.generate(hooks);

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
