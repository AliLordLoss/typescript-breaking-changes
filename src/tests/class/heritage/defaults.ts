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
export const baseClasses = {
  simple: "class Base { public method() {}; }",
  withConstructor: "class Base { constructor() {}; public method() {}; }",
};

export const baseClassKeys = Object.keys(
  baseClasses,
) as (keyof typeof baseClasses)[];

export const derivedClasses = {
  simple: "export class Derived extends Base {}",
  override: "export class Derived extends Base { public method() {}; }",
  constructor:
    "export class Derived extends Base { constructor() { super(); }; }",
  constructorAndOverride:
    "export class Derived extends Base { constructor() { super(); }; public method() {}; }",
};

export const derivedClassKeys = Object.keys(
  derivedClasses,
) as (keyof typeof derivedClasses)[];

export const genBaseClass = (key: keyof typeof baseClasses) => {
  return baseClasses[key];
};

export const genDerivedClass = (key: keyof typeof derivedClasses) => {
  return derivedClasses[key];
};
