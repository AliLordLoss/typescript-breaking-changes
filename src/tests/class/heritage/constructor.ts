import fs from "fs";
import fsPromise from "fs/promises";
import path from "path";
import pLimit from "p-limit";
import {
  baseClassStateKeys,
  baseClassStates,
  genBaseClass,
  genClient,
  genDerivedClass,
  generateBaseClassOptions,
  generateDerivedClassOptions,
} from "./defaults";

let testCount = 0;
const context = path.join(__dirname, "raw");
const files = ["v1.ts", "v2.ts", "v1.client.ts", "v2.client.ts"];
const filenames: string[] = [];
const contents: string[] = [];

const printTest = (
  name: string,
  v1Content: string,
  v2Content: string,
  v1Client: string,
  v2Client: string,
) => {
  const localCtx = `${context}/${name}`;

  if (!fs.existsSync(localCtx)) {
    fs.mkdirSync(localCtx, { recursive: true });
  }

  files.forEach((f) => filenames.push(`${localCtx}/${name}.${f}`));
  contents.push(v1Content);
  contents.push(v2Content);
  contents.push(v1Client);
  contents.push(v2Client);
};

const printChangeBaseClass = () => {
  // first check all possible modifiers for base class
  for (const baseClassStateKey of baseClassStateKeys) {
    for (const nextBaseClassStateKey of baseClassStateKeys) {
      // must be different!
      if (baseClassStateKey === nextBaseClassStateKey) continue;

      for (const {
        options: derivedOptions,
        name: derivedName,
      } of generateDerivedClassOptions()) {
        for (const heritage of ["extends", "implements"] as const) {
          const name = `changeBaseClass_${baseClassStateKey}_To_${nextBaseClassStateKey}_${heritage}_${derivedName}`;
          const derivedClass = genDerivedClass(heritage, derivedOptions);

          const v1Content = `${baseClassStates[baseClassStateKey]}${genBaseClass(
            {
              withConstructor: false,
              withPrivateMethod: false,
              withPrivateProperty: false,
            },
            baseClassStateKey.toLowerCase().includes("declare"), // check if base class is a declare!
          )}\n${derivedClass}`;
          const v2Content = `${baseClassStates[nextBaseClassStateKey]}${genBaseClass(
            {
              withConstructor: false,
              withPrivateMethod: false,
              withPrivateProperty: false,
            },
            nextBaseClassStateKey.toLowerCase().includes("declare"), // check if base class is a declare!
          )}\n${derivedClass}`;

          for (const { client, id } of genClient()) {
            printTest(
              name + id,
              v1Content,
              v2Content,
              client.replace("%importaddr%", `${name}${id}.v1`),
              client.replace("%importaddr%", `${name}${id}.v2`),
            );
            testCount++;
          }
        }
      }
    }
  }

  // now check some properties and methods in Base class
  for (const {
    options: baseOptions,
    name: baseName,
  } of generateBaseClassOptions()) {
    for (const {
      options: nextBaseOptions,
      name: nextBaseName,
    } of generateBaseClassOptions()) {
      // must be different!
      if (baseName === nextBaseName) continue;

      for (const {
        options: derivedOptions,
        name: derivedName,
      } of generateDerivedClassOptions()) {
        for (const heritage of ["extends", "implements"] as const) {
          const name = `changeBaseClass_${baseName}To_${nextBaseName}${heritage}_${derivedName}`;
          const derivedClass = genDerivedClass(heritage, derivedOptions);

          // not having override in derived, or private method and/or property in base
          // will break v1 when heritage type is implements!
          if (
            heritage === "implements" &&
            (!derivedOptions.withOverride ||
              baseOptions.withPrivateMethod ||
              baseOptions.withPrivateProperty)
          )
            continue;

          const v1Content = `${genBaseClass(
            baseOptions,
            false, // hardcoded since it's not a declare!
          )}\n${derivedClass}`;
          const v2Content = `${genBaseClass(
            nextBaseOptions,
            false, // hardcoded since it's not a declare!
          )}\n${derivedClass}`;

          for (const { client, id } of genClient()) {
            printTest(
              name + id,
              v1Content,
              v2Content,
              client.replace("%importaddr%", `${name}${id}.v1`),
              client.replace("%importaddr%", `${name}${id}.v2`),
            );
            testCount++;
          }
        }
      }
    }
  }
};

// const printAddInheritance = () => {
//   for (const baseKey of baseClassKeys) {
//     for (const derivedKey of derivedClassKeys) {
//       const name = `addInheritance_${baseKey}_With_${derivedKey}`;
//       const v1Content = `${genBaseClass(baseKey)}\nclass Derived {}`;
//       const v2Content = `${genBaseClass(baseKey)}\n${genDerivedClass(derivedKey)}`;
//       printTest(name, v1Content, v2Content);
//       testCount++;
//     }
//   }
// };

// const printRemoveInheritance = () => {
//   for (const baseKey of baseClassKeys) {
//     for (const derivedKey of derivedClassKeys) {
//       const name = `removeInheritance_${baseKey}_With_${derivedKey}`;
//       const v1Content = `${genBaseClass(baseKey)}\n${genDerivedClass(derivedKey)}`;
//       const v2Content = `${genBaseClass(baseKey)}\nclass Derived {}`;
//       printTest(name, v1Content, v2Content);
//       testCount++;
//     }
//   }
// };

const printTests = async () => {
  printChangeBaseClass();
  // printAddInheritance();
  // printRemoveInheritance();

  const limit = pLimit(50);

  await Promise.all(
    filenames.map((name, i) =>
      limit(() => fsPromise.writeFile(name, contents[i])),
    ),
  );

  console.log({ testCount });
};

if (!fs.existsSync(context)) {
  fs.mkdirSync(context, { recursive: true });
}
printTests();
