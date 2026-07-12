import fs from "fs";
import path from "path";
import {
  functionStateKeys,
  functionStates,
  genFn,
  genParam,
  isDefaultState,
  TestCase,
} from "./defaults";
import {
  generateClientArguments,
  generateV2ParamMutations,
  renameFunctionParameters,
} from "../ts-utilities";
import { isValidV2Type, runFandangoParam, runFandangoTypeAlgebra } from "..";

const MASTER_SEED = 42;

const context = path.join(__dirname, "raw");

const uniqueValues = (arr: FnSignature[]) => {
  const unique: string[] = [];
  for (const item of arr) {
    if (!unique.includes(item[0])) {
      unique.push(item[0]);
    }
  }
  return unique;
};

type FnSignature = [string, string[]]; // [name, params ]
const printClient = (
  name: string,
  fns: FnSignature[] = [],
  isDefault: boolean = false,
): [string, string] => {
  const contents = [];
  for (const version of ["v1", "v2"]) {
    let content = "";
    if (fns?.length) {
      if (isDefault) {
        content += `import ${fns[0][0]} from "./${name}.${version}";\n\n`;
      } else {
        content += `import {\n`;
        const uniqueFns = uniqueValues(fns);
        uniqueFns.forEach((fn) => {
          content += `  ${fn},\n`;
        });
        content += `} from \"./${name}.${version}\";\n\n`;
      }

      fns.forEach((fn) => {
        const [name, mockArgs] = fn;
        content += `${name}(${mockArgs.join(", ")});\n`;
      });
    }
    contents.push(content);
  }

  return [contents[0], contents[1]];
};

const printTest = (
  name: string,
  v1Content: string,
  v2Content: string,
  v1Client: string,
  v2Client: string,
) => {
  const localCtx = `${context}/${name}`;

  if (!fs.existsSync(localCtx)) {
    fs.mkdirSync(localCtx);
  }

  fs.writeFile(`${localCtx}/${name}.v1.ts`, v1Content, (err) => {
    if (err) console.log(err);
  });
  fs.writeFile(`${localCtx}/${name}.v2.ts`, v2Content, (err) => {
    if (err) console.log(err);
  });
  fs.writeFile(`${localCtx}/${name}.v1.client.ts`, v1Client, (err) => {
    if (err) console.log(err);
  });
  fs.writeFile(`${localCtx}/${name}.v2.client.ts`, v2Client, (err) => {
    if (err) console.log(err);
  });
};

// Tests
// 1. Adding a function
// 2. Removing a function
// 3. Changing a fn state - e.g., export -> export async
// 4. Add more parameters
// 5. Changing a parameter - type change, optionality change, rest parameter change, etc.
// 6. Changing a parameter - type change, using fuzzer to generate changes on a base type via type utilities
// 7. Parameter name change

const printAddFunction: () => Promise<TestCase[]> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    for (const fnStateKey of functionStateKeys) {
      const name = `addFunction_${fnStateKey}_${i}`;
      const v1Content = "";
      const v2Content =
        functionStates[fnStateKey] +
        (await genFn("fn", MASTER_SEED + i)).declaration;
      const [v1Client, v2Client] = printClient(name);

      tests.push({ name, v1Content, v2Content, v1Client, v2Client });
    }
  }

  return tests;
};

const printRemoveFunction: () => Promise<TestCase[]> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    for (const fnStateKey of functionStateKeys) {
      const name = `removeFunction_${fnStateKey}_${i}`;
      const fn = await genFn("fn", MASTER_SEED + i);
      const v1Content = functionStates[fnStateKey] + fn.declaration;
      const v2Content = "";
      const [v1Client, v2Client] = printClient(
        name,
        [[fn.name, fn.clientCallArgs]],
        isDefaultState(fnStateKey),
      );

      tests.push({ name, v1Content, v2Content, v1Client, v2Client });
    }
  }

  return tests;
};

const printChangeFunctionModifier: () => Promise<TestCase[]> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    for (const fnStateKey of functionStateKeys) {
      for (const secondaryFnStateKey of functionStateKeys) {
        if (secondaryFnStateKey === fnStateKey) continue;

        const name = `changeFunctionModifier_${fnStateKey}_to_${secondaryFnStateKey}_${i}`;
        const fn = await genFn("fn", MASTER_SEED + i);
        const v1Content = functionStates[fnStateKey] + fn.declaration;
        const v2Content = functionStates[secondaryFnStateKey] + fn.declaration;
        const [v1Client, v2Client] = printClient(
          name,
          [[fn.name, fn.clientCallArgs]],
          isDefaultState(fnStateKey),
        );
        tests.push({ name, v1Content, v2Content, v1Client, v2Client });
      }
    }
  }

  return tests;
};

const printAddParameter: () => Promise<TestCase[]> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    for (const fnStateKey of functionStateKeys) {
      const baseFn = await genFn("fn", MASTER_SEED + i);
      const paramsToAdd = await genParam(MASTER_SEED + i + 1000);
      const name = `addParameter_${fnStateKey}_${i}`;
      const v1Content = functionStates[fnStateKey] + baseFn.declaration;
      const v2Content =
        functionStates[fnStateKey] +
        baseFn.declaration.replace("){  }\n", `, ${paramsToAdd}){  }\n`);

      const [v1Client, v2Client] = printClient(
        name,
        [[baseFn.name, baseFn.clientCallArgs]],
        isDefaultState(fnStateKey),
      );
      tests.push({ name, v1Content, v2Content, v1Client, v2Client });
    }
  }

  return tests;
};

const printChangeParameter: () => Promise<TestCase[]> = async () => {
  const tests: TestCase[] = [];

  for (let i = 0; i < 10; i++) {
    for (const fnStateKey of functionStateKeys) {
      let offset = 1;
      let baseFn = await genFn("fn", MASTER_SEED + i);
      // reroll until we get a function with at least 1 parameter to mutate
      while (baseFn.params === "" && offset < 20) {
        baseFn = await genFn("fn", MASTER_SEED + i + offset * 1000);
        offset++;
      }
      // skip if rerolling didn't work after 20 attempts
      if (baseFn.params === "") {
        console.warn(
          `Skipping parameter type change test for ${fnStateKey} with seed ${MASTER_SEED + i} due to no parameters.`,
        );
        continue;
      }

      const v2ParamsArr = generateV2ParamMutations(baseFn.params);
      v2ParamsArr.forEach((v2Params, index) => {
        const name = `changeParameter_${fnStateKey}_${i}_variant${index}`;
        const v1Content =
          functionStates[fnStateKey] +
          `function ${baseFn.name}(${baseFn.params}){  }\n`;
        const v2Content =
          functionStates[fnStateKey] +
          `function ${baseFn.name}(${v2Params}){  }\n`;

        const [v1Client, v2Client] = printClient(
          name,
          [[baseFn.name, baseFn.clientCallArgs]],
          isDefaultState(fnStateKey),
        );

        tests.push({ name, v1Content, v2Content, v1Client, v2Client });

        const reverseName = name + "_reverse";
        const [v1ClientReverse, v2ClientReverse] = printClient(
          reverseName,
          [[baseFn.name, generateClientArguments(v2Params)]],
          isDefaultState(fnStateKey),
        );

        tests.push({
          name: reverseName,
          v1Content: v2Content,
          v2Content: v1Content,
          v1Client: v1ClientReverse,
          v2Client: v2ClientReverse,
        });
      });
    }
  }

  return tests;
};

const printChangeParameterTypeFuzz: () => Promise<TestCase[]> = async () => {
  const tests: TestCase[] = [];

  const BaseParamDefinition = `
interface BaseParam {
  id: string;
  name?: string;
  metadata: { createdAt: Date; active: boolean; };
}

`;

  for (let i = 0; i < 10; i++) {
    for (const fnStateKey of functionStateKeys) {
      // 1. Fandango generates the complex V2 wrapper (e.g., "Required<Pick<...>>")
      let fuzzedWrapper = await runFandangoTypeAlgebra(MASTER_SEED + i);

      let offset = 1;
      while (
        !isValidV2Type(fuzzedWrapper, BaseParamDefinition) &&
        offset < 20
      ) {
        // reroll until we get a valid type algebra
        fuzzedWrapper = await runFandangoTypeAlgebra(
          MASTER_SEED + i + offset * 1000,
        );
        offset++;
      }
      // skip if rerolling didn't work after 20 attempts
      if (!isValidV2Type(fuzzedWrapper, BaseParamDefinition)) {
        console.warn(
          `Skipping parameter type change (fuzzed) test for ${fnStateKey} with seed ${MASTER_SEED + i} due to invalid type algebra.`,
        );
        continue;
      }

      const name = `changeParameterFuzzed_${fnStateKey}_${i}`;

      // 2. V1 uses the raw BaseEntity
      const v1File =
        BaseParamDefinition +
        functionStates[fnStateKey] +
        `function fn(param: BaseParam) {}`;

      // 3. V2 uses the Fuzzed Wrapper
      const v2File =
        BaseParamDefinition +
        functionStates[fnStateKey] +
        `function fn(param: ${fuzzedWrapper}) {}`;

      // 4. The Client ALWAYS uses a mock that perfectly satisfies V1
      const isDefault = isDefaultState(fnStateKey);
      const minimalMock = `{ id: "mock", metadata: { createdAt: new Date(), active: true } }`;
      const maximalMock = `{ id: "mock", name: "mock_name", metadata: { createdAt: new Date(), active: true } }`;
      const clientCode = `
      import ${isDefault ? "fn" : "{ fn }"} from "./${name}.%version%";

      fn(${minimalMock});
      fn(${maximalMock});
    `;

      tests.push({
        name: name,
        v1Content: v1File,
        v2Content: v2File,
        v1Client: clientCode.replace("%version%", "v1"),
        v2Client: clientCode.replace("%version%", "v2"),
      });
    }
  }

  return tests;
};

const printChangeParameterName: () => Promise<TestCase[]> = async () => {
  const tests = [];

  for (let i = 0; i < 10; i++) {
    for (const fnStateKey of functionStateKeys) {
      let offset = 1;
      let baseFn = await genFn("fn", MASTER_SEED + i);
      // reroll until we get a function with at least 1 parameter to mutate
      while (baseFn.params === "" && offset < 20) {
        baseFn = await genFn("fn", MASTER_SEED + i + offset * 1000);
        offset++;
      }
      // skip if rerolling didn't work after 20 attempts
      if (baseFn.params === "") {
        console.warn(
          `Skipping parameter name change test for ${fnStateKey} with seed ${MASTER_SEED + i} due to no parameters.`,
        );
        continue;
      }

      const name = `changeParameterName_${fnStateKey}_${i}`;
      const v1Content = functionStates[fnStateKey] + baseFn.declaration;
      const v2Content =
        functionStates[fnStateKey] +
        renameFunctionParameters(baseFn.declaration);

      const [v1Client, v2Client] = printClient(
        name,
        [[baseFn.name, baseFn.clientCallArgs]],
        isDefaultState(fnStateKey),
      );

      tests.push({ name, v1Content, v2Content, v1Client, v2Client });
    }
  }

  return tests;
};

const printTests = async () => {
  const tests = await Promise.all([
    printAddFunction(),
    printRemoveFunction(),
    printChangeFunctionModifier(),
    printAddParameter(),
    printChangeParameter(),
    printChangeParameterTypeFuzz(),
    printChangeParameterName(),
  ]).then((results) => results.flat());

  tests.forEach((test) => {
    printTest(
      test.name,
      test.v1Content,
      test.v2Content,
      test.v1Client,
      test.v2Client,
    );
  });

  return { testCount: tests.length };
};

async function main() {
  if (!fs.existsSync(context)) {
    fs.mkdirSync(context);
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
