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

const BASE_CLASS_WITHOUT_METHOD = `export class Base {
  %privatemethod%
}`;

const BASE_CLASS_FEATURES = {
  Constructor: "constructor() %impl%",
  PrivateMethod: "private someMethod(): string %implstringreturn%",
  PrivateProperty: "private someProperty: string = 'hello';",
};

const BASE_CLASS_FEATURE_KEYS = Object.keys(
  BASE_CLASS_FEATURES,
) as (keyof typeof BASE_CLASS_FEATURES)[];

type BaseClassOptions = {
  withConstructor: boolean;
  withPrivateMethod: boolean;
  withPrivateProperty: boolean;
};

const DERIVED_CLASS = `export class Derived %heritage% Base {
  %constructor%

  %override%
}
`;

const DERIVED_CLASS_FEATURES = {
  Constructor: "constructor() { %supercall% };",
  Override: "method() { console.log('overridden!'); };",
};

const DERIVED_CLASS_FEATURE_KEYS = Object.keys(
  DERIVED_CLASS_FEATURES,
) as (keyof typeof DERIVED_CLASS_FEATURES)[];

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

export function genBaseClassWithoutMethod(withPrivateMethod: boolean) {
  return BASE_CLASS_WITHOUT_METHOD.replace(
    "%privatemethod%",
    withPrivateMethod
      ? resolveImplementationBody(BASE_CLASS_FEATURES.PrivateMethod, false)
      : "",
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
  SameProperty: "someProperty: string = 'hi';",
  DifferentProperty: "someProperty: number = 32;",
};

export type ClientOptions = {
  heritage: "extends" | "implements";
  modifier: "public" | "private" | "protected";
  constructor: boolean;
  override: boolean;
  method: "same" | "different" | "none";
  property: "same" | "different" | "none";
};

export function genClient(
  clientOptions: ClientOptions | null,
  addBaseClassAsType: boolean,
): {
  client: string;
} {
  // simplest client, instantiate and call method
  if (clientOptions === null) {
    return {
      client: `import { Derived${addBaseClassAsType ? ", Base" : ""} } from "./%importaddr%"; const instance${addBaseClassAsType ? ": Base" : ""} = new Derived();${addBaseClassAsType ? "" : " instance.method();"}`,
    };
  } else {
    let result = `import { Derived } from "./%importaddr%";\n${CLIENT_CLASS}`;

    return {
      client: result
        .replace("%heritage%", clientOptions.heritage)
        .replaceAll("%modifier%", clientOptions.modifier)
        .replace(
          "%constructor%",
          clientOptions.constructor
            ? resolveSuperCall(
                CLIENT_CLASS_FEATURES.Constructor,
                clientOptions.heritage === "implements",
              )
            : "",
        )
        .replace(
          "%override%",
          clientOptions.override ? CLIENT_CLASS_FEATURES.Override : "",
        )
        .replace(
          "%somemethod%",
          clientOptions.method === "same"
            ? CLIENT_CLASS_FEATURES.SameMethod
            : clientOptions.method === "different"
              ? CLIENT_CLASS_FEATURES.DifferentMethod
              : "",
        )
        .replace(
          "%someproperty%",
          clientOptions.property === "same"
            ? CLIENT_CLASS_FEATURES.SameProperty
            : clientOptions.property === "different"
              ? CLIENT_CLASS_FEATURES.DifferentProperty
              : "",
        ),
    };
  }
}
