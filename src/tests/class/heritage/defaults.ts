import { classStates } from "../defaults";

export const baseClassStates = {
  empty: "",
  declare: "declare ",
  abstract: "abstract ",
  declareAbstract: "declare abstract ",
  ...classStates,
};

export const baseClassStateKeys = Object.keys(
  baseClassStates,
) as (keyof typeof baseClassStates)[];

/*
 *  Inheritance
 */
const resolveImplementationBody = (item: string, isDeclare: boolean) =>
  item
    .replace("%impl%", isDeclare ? "" : "{};")
    .replace("%implstringreturn%", isDeclare ? "" : "{ return ''; };");

const resolveSuperCall = (item: string, isImplements: boolean) =>
  item.replace("%supercall%", isImplements ? "" : "super();");

const BASE_CLASS = `class Base {
  %privateproperty%

  %constructor%

  public method() %impl%

  %privatemethod%
}
`;

const BASE_CLASS_FEATURES = {
  Constructor: "constructor() %impl%",
  PrivateMethod: "private someMethod(): string %implstringreturn%",
  PrivateProperty: "private someProperty: string;",
};

const BASE_CLASS_FEATURE_KEYS = Object.keys(
  BASE_CLASS_FEATURES,
) as (keyof typeof BASE_CLASS_FEATURES)[];

type BaseClassOptions = {
  withConstructor: boolean;
  withPrivateMethod: boolean;
  withPrivateProperty: boolean;
};

const baseClassOptionsAllFalse: BaseClassOptions = {
  withConstructor: false,
  withPrivateMethod: false,
  withPrivateProperty: false,
};

export function* generateBaseClassOptions(): Generator<{
  options: BaseClassOptions;
  name: string;
}> {
  const keys: (keyof BaseClassOptions)[] = [
    "withConstructor",
    "withPrivateMethod",
    "withPrivateProperty",
  ];
  // 2^n combinations
  const total = 1 << keys.length;

  for (let i = 0; i < total; i++) {
    // copy from all false instance
    const combination: BaseClassOptions = { ...baseClassOptionsAllFalse };
    let name = "";
    for (let bit = 0; bit < keys.length; bit++) {
      combination[keys[bit]] = Boolean((i >> bit) & 1);
      if (combination[keys[bit]]) name += keys[bit] + "_";
    }
    yield {
      options: combination,
      name,
    };
  }
}

const DERIVED_CLASS = `export class Derived %heritage% Base {
  %constructor%

  %override%;
}
`;

const DERIVED_CLASS_FEATURES = {
  Constructor: "constructor() { %supercall% };",
  Override: "method() { console.log('overridden!'); };",
};

const DERIVED_CLASS_FEATURE_KEYS = Object.keys(
  DERIVED_CLASS_FEATURES,
) as (keyof typeof DERIVED_CLASS_FEATURES)[];

const derivedClassOptionsAllFalse: DerivedClassOptions = {
  withConstructor: false,
  withOverride: false,
};

type DerivedClassOptions = {
  withConstructor: boolean;
  withOverride: boolean;
};

export function* generateDerivedClassOptions(): Generator<{
  options: DerivedClassOptions;
  name: string;
}> {
  const keys: (keyof DerivedClassOptions)[] = [
    "withConstructor",
    "withOverride",
  ];
  // 2^n combinations
  const total = 1 << keys.length;

  for (let i = 0; i < total; i++) {
    // copy from all false instance
    const combination: DerivedClassOptions = { ...derivedClassOptionsAllFalse };
    let name = "";
    for (let bit = 0; bit < keys.length; bit++) {
      combination[keys[bit]] = Boolean((i >> bit) & 1);
      if (combination[keys[bit]]) name += keys[bit] + "_";
    }
    yield {
      options: combination,
      name,
    };
  }
}

export function genBaseClass(options: BaseClassOptions, isDeclare: boolean) {
  return BASE_CLASS_FEATURE_KEYS.reduce(
    (acc, item) => {
      return acc.replace(
        `%${item.toLowerCase()}%`,
        options[`with${item}`]
          ? resolveImplementationBody(BASE_CLASS_FEATURES[item], isDeclare)
          : "",
      );
    },
    resolveImplementationBody(BASE_CLASS, isDeclare),
  );
}

export function genDerivedClass(
  heritage: "extends" | "implements",
  options: {
    withConstructor: boolean;
    withOverride: boolean;
  },
) {
  return DERIVED_CLASS_FEATURE_KEYS.reduce(
    (acc, item) =>
      acc.replace(
        `%${item.toLowerCase()}%`,
        options[`with${item}`]
          ? resolveSuperCall(
              DERIVED_CLASS_FEATURES[item],
              heritage === "implements",
            )
          : "",
      ),
    DERIVED_CLASS.replace("%heritage%", heritage),
  );
}

const CLIENT_CLASS = `class Client %heritage% Derived {
  %constructor%

  %override%

  %modifier% %somemethod%

  %modifier% %someproperty%
}
`;

const CLIENT_CLASS_FEATURES = {
  Constructor: "constructor() { %supercall% };",
  Override: "method() { console.log('overridden in client!'); };",
  SameMethod: "someMethod(): string { return ''; };",
  DifferentMethod: "someMethod(): number { return 0; };",
  SameProperty: "someProperty: string;",
  DifferentProperty: "someProperty: number;",
};

export function* genClient(): Generator<{ client: string; id: number }> {
  let clientId = 0;
  // simplest client, instantiate and call method
  yield {
    client: `import { Derived } from "./%importaddr%"; const instance = new Derived(); instance.method();`,
    id: clientId,
  };
  clientId++;

  // now generate some heritage usage!
  for (const heritage of ["extends", "implements"]) {
    let result = `import { Derived } from "./%importaddr%";\n${CLIENT_CLASS}`;
    result = result.replace("%heritage%", heritage);
    for (const modifier of ["public", "private", "protected"]) {
      result = result.replaceAll("%modifier%", modifier);
      for (const constructor of [true, false]) {
        for (const override of [true, false]) {
          for (const sameMethod of [true, false]) {
            for (const sameProperty of [true, false]) {
              yield {
                client: result
                  .replace(
                    "%constructor%",
                    constructor
                      ? resolveSuperCall(
                          CLIENT_CLASS_FEATURES.Constructor,
                          heritage === "implements",
                        )
                      : "",
                  )
                  .replace(
                    "%override%",
                    override && heritage === "extends"
                      ? CLIENT_CLASS_FEATURES.Override
                      : "",
                  )
                  .replace(
                    "%somemethod%",
                    sameMethod
                      ? CLIENT_CLASS_FEATURES.SameMethod
                      : CLIENT_CLASS_FEATURES.DifferentMethod,
                  )
                  .replace(
                    "%someproperty%",
                    sameProperty
                      ? CLIENT_CLASS_FEATURES.SameProperty
                      : CLIENT_CLASS_FEATURES.DifferentProperty,
                  ),
                id: clientId,
              };
              clientId++;
            }
          }
        }
      }
    }
  }
}
