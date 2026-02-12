import fs from "fs";
import path from "path";
import {
  baseClassKeys,
  derivedClassKeys,
  genBaseClass,
  genDerivedClass,
} from "./defaults";
import { baseClassStates, baseClassStateKeys } from "./defaults";

let testCount = 0;
const context = path.join(__dirname, "raw");
const files = ["v1.ts", "v2.ts", "v1.client.ts", "v2.client.ts"];
const filenames: string[] = [];
const contents: string[] = [];

const printClient = (name: string): [string, string] => {
  const usage = "const instance = new Derived();\ninstance.method();\n";
  const v1Content = `import { Derived } from "./${name}.v1";\n${usage}`;
  const v2Content = `import { Derived } from "./${name}.v2";\n${usage}`;
  return [v1Content, v2Content];
};

const printTest = (name: string, v1Content: string, v2Content: string) => {
  const localCtx = `${context}/${name}`;

  if (!fs.existsSync(localCtx)) {
    fs.mkdirSync(localCtx, { recursive: true });
  }

  const [v1Client, v2Client] = printClient(name);

  files.forEach((f) => filenames.push(`${localCtx}/${name}.${f}`));
  contents.push(v1Content);
  contents.push(v2Content);
  contents.push(v1Client);
  contents.push(v2Client);
};

const printChangeBaseClass = () => {
  for (const baseClassStateKey of baseClassStateKeys) {
    for (const baseKey of baseClassKeys) {
      for (const derivedKey of derivedClassKeys) {
        for (const nextBaseClassStateKey of baseClassStateKeys) {
          for (const nextBaseKey of baseClassKeys) {
            // at least on should be different!
            if (
              baseKey === nextBaseKey &&
              baseClassStateKey === nextBaseClassStateKey
            )
              continue;
            const name = `changeBaseClass_${baseClassStateKey}_${baseKey}_To_${nextBaseClassStateKey}_${nextBaseKey}_${derivedKey}`;
            const v1Content = `${baseClassStates[baseClassStateKey]}${genBaseClass(baseKey)}\n${genDerivedClass(derivedKey)}`;
            const v2Content = `${baseClassStates[nextBaseClassStateKey]}${genBaseClass(nextBaseKey)}\n${genDerivedClass(derivedKey)}`;
            printTest(name, v1Content, v2Content);
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

const printTests = () => {
  printChangeBaseClass();
  // printAddInheritance();
  // printRemoveInheritance();

  for (let i = 0; i < filenames.length; i++) {
    fs.writeFile(filenames[i], contents[i], (err) => {
      if (err) console.log(err);
    });
  }
  return { testCount };
};

if (!fs.existsSync(context)) {
  fs.mkdirSync(context, { recursive: true });
}
const r = printTests();
console.log(r);
