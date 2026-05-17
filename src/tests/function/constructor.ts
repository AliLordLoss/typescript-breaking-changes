import fs from "fs";
import {
  functionStateKeys,
  functionStates,
  genFn,
  isDefaultState,
  isUsedWithMoreParams,
  isUsedWithoutParam,
  isUsedWithParam,
  paramStates,
} from "./defaults";

let testCount = 0;
const context = "src/tests/function/raw";
const files = ["v1.ts", "v2.ts", "v1.client.ts", "v2.client.ts"];
const filenames: string[] = [];
const contents: string[] = [];

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
        const [name, params] = fn;
        content += `${name}(`;
        if (params?.length) {
          params.forEach((param, i) => {
            content += `${param}`;
            if (i !== params.length - 1) {
              content += ", ";
            }
          });
        }
        content += `);\n`;
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

  files.forEach((f) => filenames.push(`${localCtx}/${name}.${f}`));
  contents.push(v1Content);
  contents.push(v2Content);
  contents.push(v1Client);
  contents.push(v2Client);
};

// Tests
// 1. Adding a function
// 2. Removing a function
// 3. Changing a fn state
// 3. Changing a parameter - from no params; all operators; with and without declared type; all fn states
//  - Do it for all 5 states to include params too
// 4. Parameter name change - all 4 states with param, type and no type

const printAddFunction = () => {
  for (const fnStateKey of functionStateKeys) {
    const name = `addFunction_${fnStateKey}`;
    const v1Content = "";
    const v2Content = functionStates[fnStateKey] + genFn("none");
    const [v1Client, v2Client] = printClient(name);

    printTest(name, v1Content, v2Content, v1Client, v2Client);
    testCount++;
  }
};

const printRemoveFunction = () => {
  for (const fnStateKey of functionStateKeys) {
    const name = `removeFunction_${fnStateKey}`;
    const v1Content = functionStates[fnStateKey] + genFn("none");
    const v2Content = "";
    const [v1Client, v2Client] = printClient(
      name,
      [["a", []]],
      isDefaultState(fnStateKey),
    );

    printTest(name, v1Content, v2Content, v1Client, v2Client);
    testCount++;
  }
};

const printChangeFunctionModifier = () => {
  for (const fnStateKey of functionStateKeys) {
    for (const secondaryFnStateKey of functionStateKeys) {
      if (secondaryFnStateKey === fnStateKey) continue;

      const name = `changeFunctionModifier_${fnStateKey}_to_${secondaryFnStateKey}`;
      const v1Content = functionStates[fnStateKey] + genFn("none");
      const v2Content = functionStates[secondaryFnStateKey] + genFn("none");
      const [v1Client, v2Client] = printClient(
        name,
        [["a", []]],
        isDefaultState(fnStateKey),
      );

      printTest(name, v1Content, v2Content, v1Client, v2Client);
      testCount++;
    }
  }
};

const printChangeParameter = () => {
  // For all function states
  for (const fnStateKey of functionStateKeys) {
    // For all parameter states
    for (const param of paramStates) {
      // For with and without a declared type
      for (const secondaryParam of paramStates) {
        if (param === secondaryParam) continue;
        const name = `changeParameter_${fnStateKey}_${param}_to${secondaryParam}`;

        const v1Content = functionStates[fnStateKey] + genFn(param, "a", "x");
        const v2Content =
          functionStates[fnStateKey] + genFn(secondaryParam, "a", "x");

        const fnSignatures: FnSignature[] = [];
        if (isUsedWithoutParam(param)) fnSignatures.push(["a", []]);
        if (isUsedWithParam(param)) fnSignatures.push(["a", ["1"]]);
        if (isUsedWithMoreParams(param)) fnSignatures.push(["a", ["1", "2"]]);

        const [v1Client, v2Client] = printClient(
          name,
          fnSignatures,
          isDefaultState(fnStateKey),
        );
        printTest(name, v1Content, v2Content, v1Client, v2Client);
        testCount++;
      }
    }
  }
};

const printChangeParameterName = () => {
  // For all function states
  for (const fnStateKey of functionStateKeys) {
    // For all parameter states
    for (const param of paramStates) {
      // For with and without a declared type
      const name = `changeParameterName_${fnStateKey}_${param}`;
      const v1Content = functionStates[fnStateKey] + genFn(param, "a", "x");
      const v2Content = functionStates[fnStateKey] + genFn(param, "a", "y");
      const fnSignatures: FnSignature[] = [];
      if (isUsedWithoutParam(param)) fnSignatures.push(["a", []]);
      if (isUsedWithParam(param)) fnSignatures.push(["a", ["1"]]);
      if (isUsedWithMoreParams(param)) fnSignatures.push(["a", ["1", "2"]]);
      const [v1Client, v2Client] = printClient(
        name,
        fnSignatures,
        isDefaultState(fnStateKey),
      );
      printTest(name, v1Content, v2Content, v1Client, v2Client);
      testCount++;
    }
  }
};

const printTests = () => {
  printAddFunction();
  printRemoveFunction();
  printChangeFunctionModifier();
  printChangeParameter();
  printChangeParameterName();
  for (let i = 0; i < filenames.length; i++) {
    fs.writeFile(filenames[i], contents[i], (err) => {
      if (err) console.log(err);
    });
  }
  return { testCount };
};

if (!fs.existsSync(context)) {
  fs.mkdirSync(context);
}
const r = printTests();
console.log(r);
