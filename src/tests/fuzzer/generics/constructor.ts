import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { isValidV2Type, runFandangoParam, runFandangoTypeAlgebra } from "..";
import { BASE_PARAM_DEF, TestCase } from "./defaults";
import { generateClientArguments } from "../ts-utilities";

const MASTER_SEED = 42;

const context = path.join(__dirname, "raw");

const printTest = async (
  name: string,
  v1Content: string,
  v2Content: string,
  v1Client: string,
  v2Client: string,
) => {
  const localCtx = `${context}/${name}`;

  if (!existsSync(localCtx)) {
    mkdirSync(localCtx);
  }

  await fs.writeFile(`${localCtx}/${name}.v1.ts`, v1Content);
  await fs.writeFile(`${localCtx}/${name}.v2.ts`, v2Content);
  await fs.writeFile(`${localCtx}/${name}.v1.client.ts`, v1Client);
  await fs.writeFile(`${localCtx}/${name}.v2.client.ts`, v2Client);
};

const printChangeBaseParameterToGeneric: () => Promise<
  TestCase[]
> = async () => {
  const name = `changeBaseParameterToGeneric`;

  const v1File = BASE_PARAM_DEF + `export function fn(entity: BaseParam) {}`;
  const v2File =
    BASE_PARAM_DEF + `export function fn<T extends BaseParam>(entity: T) {}`;

  const minimalMock = `{ id: "mock", metadata: { createdAt: new Date(), active: true } }`;
  const maximalMock = `{ id: "mock", name: "mock_name", metadata: { createdAt: new Date(), active: true } }`;

  const clientCode = `import { fn } from "./${name}.%version%";

fn(${minimalMock});
fn(${maximalMock});
`;

  return [
    {
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    },
  ];
};

const printChangeGenericToBaseParameter: () => Promise<
  TestCase[]
> = async () => {
  const name = `changeGenericToBaseParameter`;

  const v1File =
    BASE_PARAM_DEF + `export function fn<T extends BaseParam>(entity: T) {}`;
  const v2File = BASE_PARAM_DEF + `export function fn(entity: BaseParam) {}`;

  const minimalMock = `{ id: "mock", metadata: { createdAt: new Date(), active: true } }`;
  const maximalMock = `{ id: "mock", name: "mock_name", metadata: { createdAt: new Date(), active: true } }`;

  const clientCode = `import { fn } from "./${name}.%version%";

fn(${minimalMock});
fn(${maximalMock});
`;

  return [
    {
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    },
  ];
};

const printChangeGenericType: () => Promise<TestCase[]> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF)) {
      console.warn(
        `Skipping change generic type with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `changeGenericType_${i}`;

    const v1File =
      BASE_PARAM_DEF + `export function fn<T extends BaseParam>(entity: T) {}`;
    const v2File =
      BASE_PARAM_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;

    const minimalMock = `{ id: "mock", metadata: { createdAt: new Date(), active: true } }`;
    const maximalMock = `{ id: "mock", name: "mock_name", metadata: { createdAt: new Date(), active: true } }`;

    const clientCode = `import { fn } from "./${name}.%version%";

fn(${minimalMock});
fn(${maximalMock});
    `;

    tests.push({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
  }

  return tests;
};

const printAddDefaultToGeneric: () => Promise<TestCase[]> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF)) {
      console.warn(
        `Skipping add default to generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `addDefaultToGeneric_${i}`;

    const v1File =
      BASE_PARAM_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;
    const v2File =
      BASE_PARAM_DEF +
      `export function fn<T extends ${fuzzedWrapper} = ${fuzzedWrapper}>(entity: T) {}`;

    const mock = generateClientArguments(`par: ${fuzzedWrapper}`)[0];

    const clientCode = `import { fn, BaseParam } from "./${name}.%version%";

fn<${fuzzedWrapper}>(${mock});
`;

    tests.push({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
  }

  return tests;
};

const printRemoveDefaultFromGeneric: () => Promise<TestCase[]> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF)) {
      console.warn(
        `Skipping remove default from generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `removeDefaultFromGeneric_${i}`;

    const v1File =
      BASE_PARAM_DEF +
      `export function fn<T extends ${fuzzedWrapper} = ${fuzzedWrapper}>(entity: T) {}`;
    const v2File =
      BASE_PARAM_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;

    const mock = generateClientArguments(`par: ${fuzzedWrapper}`)[0];

    const clientCode = `import { fn, BaseParam } from "./${name}.%version%";

fn<${fuzzedWrapper}>(${mock});
`;

    tests.push({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
  }

  return tests;
};

const printAddConstraintToGeneric: () => Promise<TestCase[]> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF)) {
      console.warn(
        `Skipping add constraint to generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `addConstraintToGeneric_${i}`;

    const v1File = BASE_PARAM_DEF + `export function fn<T>(entity: T) {}`;
    const v2File =
      BASE_PARAM_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;

    const mock = generateClientArguments(`par: ${fuzzedWrapper}`)[0];

    const clientCode = `import { fn } from "./${name}.%version%";

fn(${mock});
fn(5);
`;

    tests.push({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
  }

  return tests;
};

const printRemoveConstraintFromGeneric: () => Promise<
  TestCase[]
> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

    let offset = 1;
    while (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF) && offset < 20) {
      // reroll until we get a valid type algebra
      fuzzedWrapper = await runFandangoTypeAlgebra(
        MASTER_SEED + i + offset * 1000,
      );
      offset++;
    }
    // skip if rerolling didn't work after 20 attempts
    if (!isValidV2Type(fuzzedWrapper, BASE_PARAM_DEF)) {
      console.warn(
        `Skipping remove constraint from generic with seed ${MASTER_SEED + i} due to invalid type algebra.`,
      );
      continue;
    }

    const name = `removeConstraintFromGeneric_${i}`;

    const v1File =
      BASE_PARAM_DEF +
      `export function fn<T extends ${fuzzedWrapper}>(entity: T) {}`;
    const v2File = BASE_PARAM_DEF + `export function fn<T>(entity: T) {}`;

    const mock = generateClientArguments(`par: ${fuzzedWrapper}`)[0];

    const clientCode = `import { fn } from "./${name}.%version%";

fn(${mock});
`;

    tests.push({
      name,
      v1Content: v1File,
      v2Content: v2File,
      v1Client: clientCode.replaceAll("%version%", "v1"),
      v2Client: clientCode.replaceAll("%version%", "v2"),
    });
  }

  return tests;
};

const printTests = async () => {
  const tests = await Promise.all([
    printChangeBaseParameterToGeneric(),
    printChangeGenericToBaseParameter(),
    printChangeGenericType(),
    printAddDefaultToGeneric(),
    printRemoveDefaultFromGeneric(),
    printAddConstraintToGeneric(),
    printRemoveConstraintFromGeneric(),
  ]).then((results) => results.flat());

  await Promise.all(
    tests.map((test) =>
      printTest(
        test.name,
        test.v1Content,
        test.v2Content,
        test.v1Client,
        test.v2Client,
      ),
    ),
  );

  return { testCount: tests.length };
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
