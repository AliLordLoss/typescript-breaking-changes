import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { isValidV2Type, runFandangoParam, runFandangoTypeAlgebra } from "..";
import { generateClientArguments } from "../ts-utilities";
import { BASE_PARAMS_DEF } from "..";
import type { TestCase } from "..";

const MASTER_SEED = 42;

const GENERATION_COUNT = 100;

const context = path.join(__dirname, "raw");

const printTest = async (testCase: TestCase) => {
  const localCtx = `${context}/${testCase.name}`;

  if (!existsSync(localCtx)) {
    mkdirSync(localCtx);
  }

  await fs.writeFile(`${localCtx}/${testCase.name}.v1.ts`, testCase.v1Content);
  await fs.writeFile(`${localCtx}/${testCase.name}.v2.ts`, testCase.v2Content);
  await fs.writeFile(
    `${localCtx}/${testCase.name}.v1.client.ts`,
    testCase.v1Client,
  );
  await fs.writeFile(
    `${localCtx}/${testCase.name}.v2.client.ts`,
    testCase.v2Client,
  );
};

const printChangeBaseParameterToGeneric: () => Promise<number> = async () => {
  const name = `changeBaseParameterToGeneric`;

  const v1File = BASE_PARAMS_DEF + `export function fn(entity: BaseParam) {}`;
  const v2File =
    BASE_PARAMS_DEF + `export function fn<T extends BaseParam>(entity: T) {}`;

  const minimalMock = `{ id: "mock", metadata: { createdAt: new Date(), active: true } }`;
  const maximalMock = `{ id: "mock", name: "mock_name", metadata: { createdAt: new Date(), active: true } }`;

  const clientCode = `import { fn } from "./${name}.%version%";

fn(${minimalMock});
fn(${maximalMock});
`;

  printTest({
    name,
    v1Content: v1File,
    v2Content: v2File,
    v1Client: clientCode.replaceAll("%version%", "v1"),
    v2Client: clientCode.replaceAll("%version%", "v2"),
  });

  return 1;
};

const printChangeGenericToBaseParameter: () => Promise<number> = async () => {
  const name = `changeGenericToBaseParameter`;

  const v1File =
    BASE_PARAMS_DEF + `export function fn<T extends BaseParam>(entity: T) {}`;
  const v2File = BASE_PARAMS_DEF + `export function fn(entity: BaseParam) {}`;

  const minimalMock = `{ id: "mock", metadata: { createdAt: new Date(), active: true } }`;
  const maximalMock = `{ id: "mock", name: "mock_name", metadata: { createdAt: new Date(), active: true } }`;

  const clientCode = `import { fn, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

fn(${minimalMock});
fn<BaseParam>(${maximalMock});
`;

  printTest({
    name,
    v1Content: v1File,
    v2Content: v2File,
    v1Client: clientCode.replaceAll("%version%", "v1"),
    v2Client: clientCode.replaceAll("%version%", "v2"),
  });

  return 1;
};

const printChangeGenericConstraint: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping change generic constraint with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `changeGenericConstraint_${i}`;

    const v1File =
      BASE_PARAMS_DEF + `export function fn<T extends BaseParam>(entity: T) {}`;
    const v2File =
      BASE_PARAMS_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;

    const minimalMock = `{ id: "mock", metadata: { createdAt: new Date(), active: true } }`;
    const maximalMock = `{ id: "mock", name: "mock_name", metadata: { createdAt: new Date(), active: true } }`;

    const clientCode = `import { fn, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

fn(${minimalMock});
fn<BaseParam>(${maximalMock});
    `;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printAddDefaultToGeneric: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping add default to generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `addDefaultToGeneric_${i}`;

    const v1File =
      BASE_PARAMS_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;
    const v2File =
      BASE_PARAMS_DEF +
      `export function fn<T extends ${fuzzedWrapper} = ${fuzzedWrapper}>(entity: T) {}`;

    const mock = generateClientArguments(`par: ${fuzzedWrapper}`)[0];

    const clientCode = `import { fn, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

fn<${fuzzedWrapper}>(${mock});
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printRemoveDefaultFromGeneric: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping remove default from generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `removeDefaultFromGeneric_${i}`;

    const v1File =
      BASE_PARAMS_DEF +
      `export function fn<T extends ${fuzzedWrapper} = ${fuzzedWrapper}>(entity: T) {}`;
    const v2File =
      BASE_PARAMS_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;

    const mock = generateClientArguments(`par: ${fuzzedWrapper}`)[0];

    const clientCode = `import { fn, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

fn<${fuzzedWrapper}>(${mock});
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printAddConstraintToGeneric: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping add constraint to generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `addConstraintToGeneric_${i}`;

    const v1File = BASE_PARAMS_DEF + `export function fn<T>(entity: T) {}`;
    const v2File =
      BASE_PARAMS_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;

    const mock = generateClientArguments(`par: ${fuzzedWrapper}`)[0];

    const clientCode = `import { fn, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

fn<${fuzzedWrapper}>(${mock});
fn(5);
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printRemoveConstraintFromGeneric: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping remove constraint from generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `removeConstraintFromGeneric_${i}`;

    const v1File =
      BASE_PARAMS_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;
    const v2File = BASE_PARAMS_DEF + `export function fn<T>(entity: T) {}`;

    const mock = generateClientArguments(`par: ${fuzzedWrapper}`)[0];

    const clientCode = `import { fn, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

fn<${fuzzedWrapper}>(${mock});
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printAddOptionalGenericParameter: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping add optional generic parameter with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `addOptionalGenericParameter_${i}`;

    const v1File = BASE_PARAMS_DEF + `export function fn<T>(entity: T) {}`;
    const v2File =
      BASE_PARAMS_DEF +
      `export function fn<T, U extends ${fuzzedWrapper}>(entity: T, options?: U) {}`;

    // client explicitly specified generic parameter type, may break for the second generic parameter eventhough it's optional
    const clientCode = `import { fn } from "./${name}.%version%";

fn('a');
fn<number>(5);
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printChangeKeyofGeneric: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping remove constraint from generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `changeKeyofGeneric_${i}`;

    const v1File =
      BASE_PARAMS_DEF +
      `export function fn<T extends BaseParam, K extends keyof T>(entity: T, key: K) {}`;
    const v2File =
      BASE_PARAMS_DEF +
      `export function fn<T extends BaseParam, K extends keyof ${fuzzedWrapper}>(entity: T, key: K) {}`;

    const minimalMock = `{ id: "mock", metadata: { createdAt: new Date(), active: true } }`;
    const maximalMock = `{ id: "mock", name: "mock_name", metadata: { createdAt: new Date(), active: true } }`;

    const clientCode = `import { fn, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

fn(${minimalMock}, "id");
fn<BaseParam, keyof BaseParam>(${maximalMock}, "name");
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  // one simple test case for the change of keyof to Extract<keyof T, string>, no need to fuzz
  printTest({
    name: "changeKeyofGeneric_Simple",
    v1Content: `export function fn<T, K extends keyof T>(entity: T, key: K) {}`,
    v2Content: `export function fn<T, K extends Extract<keyof T, string>>(entity: T, key: K) {}`,
    v1Client: `import { fn } from "./ChangeKeyofGeneric_Simple.v1";

const s = Symbol("s");
const obj = { a: 1, 2: 3, [s]: 4 };

fn(obj, "a");
fn<{ a: number, 2: number, [s]: number }, 2>(obj, 2);
fn(obj, s);
`,
    v2Client: `import { fn } from "./ChangeKeyofGeneric_Simple.v2";

const s = Symbol("s");
const obj = { a: 1, 2: 3, [s]: 4 };

fn(obj, "a");
fn<{ a: number, 2: number, [s]: number }, 2>(obj, 2);
fn(obj, s);
`,
  });

  return count;
};

const printAddGenericToClass: () => Promise<number> = async () => {
  const name = `addGenericToClass`;

  const v1File = BASE_PARAMS_DEF + `export class Base {}`;
  const v2File = BASE_PARAMS_DEF + `export class Base<T> {}`;

  const clientCode = `import { Base } from "./${name}.%version%";

const b = new Base();

class C1 extends Base {};

class C2 implements Base {};
`;

  printTest({
    name,
    v1Content: v1File,
    v2Content: v2File,
    v1Client: clientCode.replaceAll("%version%", "v1"),
    v2Client: clientCode.replaceAll("%version%", "v2"),
  });

  return 1;
};

const printRemoveGenericFromClass: () => Promise<number> = async () => {
  const name = `removeGenericFromClass`;

  const v1File = BASE_PARAMS_DEF + `export class Base<T> {}`;
  const v2File = BASE_PARAMS_DEF + `export class Base {}`;

  const clientCode = `import { Base } from "./${name}.%version%";

const b1 = new Base();
const b2 = new Base<number>();

class C1<T> extends Base<T> {};
class C2 extends Base<number> {};

class C3<T> implements Base<T> {};
class C4 implements Base<number> {};
`;

  printTest({
    name,
    v1Content: v1File,
    v2Content: v2File,
    v1Client: clientCode.replaceAll("%version%", "v1"),
    v2Client: clientCode.replaceAll("%version%", "v2"),
  });

  return 1;
};

const printAddConstraintToClassGeneric: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping add constraint to class generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `addConstraintToClassGeneric_${i}`;

    const v1File = BASE_PARAMS_DEF + `export class Base<T> {}`;
    const v2File =
      BASE_PARAMS_DEF + `export class Base<T extends ${fuzzedWrapper}> {}`;

    const clientCode = `import { Base } from "./${name}.%version%";

const b1 = new Base();
const b2 = new Base<number>();

class C1<T> extends Base<T> {};
class C2 extends Base<number> {};

class C3<T> implements Base<T> {};
class C4 implements Base<number> {};
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printRemoveConstraintFromClassGeneric: () => Promise<number> =
  async () => {
    let count = 0;

    for (let i = 0; i < GENERATION_COUNT; i++) {
      let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

      let offset = 1;
      while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
        // reroll until we get a valid type algebra
        fuzzedWrapper = await runFandangoTypeAlgebra(
          MASTER_SEED + i + offset * 1000,
        );
        offset++;
      }
      // skip if rerolling didn't work after 20 attempts
      if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
        console.warn(
          `Skipping remove constraint from class generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
        );
        continue;
      }

      const name = `removeConstraintFromClassGeneric_${i}`;

      const v1File =
        BASE_PARAMS_DEF + `export class Base<T extends ${fuzzedWrapper}> {}`;
      const v2File = BASE_PARAMS_DEF + `export class Base<T> {}`;

      const clientCode = `import { Base, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

const b1 = new Base();
const b2 = new Base<${fuzzedWrapper}>();

class C1<T extends ${fuzzedWrapper}> extends Base<T> {};
class C2 extends Base<${fuzzedWrapper}> {};

class C3<T extends ${fuzzedWrapper}> implements Base<T> {};
class C4 implements Base<${fuzzedWrapper}> {};
`;

      printTest({
        name,
        v1Content: v1File,
        v2Content: v2File,
        v1Client: clientCode.replaceAll("%version%", "v1"),
        v2Client: clientCode.replaceAll("%version%", "v2"),
      });
      count++;
    }

    return count;
  };

const printChangeConstraintClassGeneric: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping change constraint from class generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `changeConstraintClassGeneric_${i}`;

    const v1File =
      BASE_PARAMS_DEF + `export class Base<T extends BaseParam> {}`;
    const v2File =
      BASE_PARAMS_DEF + `export class Base<T extends ${fuzzedWrapper}> {}`;

    const clientCode = `import { Base, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

const b1 = new Base();
const b2 = new Base<BaseParam>();

class C1<T extends BaseParam> extends Base<T> {};
class C2 extends Base<BaseParam> {};

class C3<T extends BaseParam> implements Base<T> {};
class C4 implements Base<BaseParam> {};
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printAddDefaultToClassGeneric: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping add default to class generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `addDefaultToClassGeneric_${i}`;

    const v1File =
      BASE_PARAMS_DEF + `export class Base<T extends ${fuzzedWrapper}> {}`;
    const v2File =
      BASE_PARAMS_DEF +
      `export class Base<T extends ${fuzzedWrapper} = ${fuzzedWrapper}> {}`;

    const clientCode = `import { Base, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

const b1 = new Base();
const b2 = new Base<${fuzzedWrapper}>();

class C1<T extends ${fuzzedWrapper}> extends Base<T> {};
class C2 extends Base<${fuzzedWrapper}> {};

class C3<T extends ${fuzzedWrapper}> implements Base<T> {};
class C4 implements Base<${fuzzedWrapper}> {};
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printRemoveDefaultFromClassGeneric: () => Promise<number> = async () => {
  let count = 0;

  for (let i = 0; i < GENERATION_COUNT; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAMS_DEF)) {
      console.warn(
        `Skipping remove default from class generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `removeDefaultFromClassGeneric_${i}`;

    const v1File =
      BASE_PARAMS_DEF +
      `export class Base<T extends ${fuzzedWrapper} = ${fuzzedWrapper}> {}`;
    const v2File =
      BASE_PARAMS_DEF + `export class Base<T extends ${fuzzedWrapper}> {}`;

    const clientCode = `import { Base, BaseParam, SuperBaseParam, ChildBaseParam } from "./${name}.%version%";

const b1 = new Base();
const b2 = new Base<${fuzzedWrapper}>();

class C1<T extends ${fuzzedWrapper}> extends Base<T> {};
class C2 extends Base<${fuzzedWrapper}> {};

class C3<T extends ${fuzzedWrapper}> implements Base<T> {};
class C4 implements Base<${fuzzedWrapper}> {};
`;

    printTest({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
    count++;
  }

  return count;
};

const printTests = async () => {
  const testCount = await Promise.all([
    printChangeBaseParameterToGeneric(),
    printChangeGenericToBaseParameter(),
    printChangeGenericConstraint(),
    printAddDefaultToGeneric(),
    printRemoveDefaultFromGeneric(),
    printAddConstraintToGeneric(),
    printRemoveConstraintFromGeneric(),
    printAddOptionalGenericParameter(),
    printChangeKeyofGeneric(),
    printAddGenericToClass(),
    printRemoveGenericFromClass(),
    printAddConstraintToClassGeneric(),
    printRemoveConstraintFromClassGeneric(),
    printChangeConstraintClassGeneric(),
    printAddDefaultToClassGeneric(),
    printRemoveDefaultFromClassGeneric(),
  ]).then((results) => results.reduce((acc, item) => acc + item, 0));

  // await Promise.all(
  //   tests.map((test) =>
  //     printTest(
  //       test.name,
  //       test.v1Content,
  //       test.v2Content,
  //       test.v1Client,
  //       test.v2Client,
  //     ),
  //   ),
  // );

  return { testCount };
};

async function main() {
  if (!existsSync(context)) {
    mkdirSync(context);
  }

  // check fandango availability
  try {
    await runFandangoParam(0);

    printTests()
      .then((r) => {
        console.log(r);
      })
      .catch((e) => {
        console.error(e);
      });
  } catch (e) {
    console.error(
      `Error executing fandango. Is fandango available? Please run this script in an environment with it installed.
Use \`pip install fandango-fuzzer\` to install it in a Python environment.
Error: ${e}`,
    );
  }
}

main();
