import { enumsStates } from "./defaults";
import fs from "fs";

let testCount = 0;
const context = "src/tests/enum/raw";
const files = ["v1.ts", "v2.ts", "v1.client.ts", "v2.client.ts"];
const filenames: string[] = [];
const contents: string[] = [];

const printLibraryV1 = (initializer?: string, memberTwo?: boolean) => {
  let content = "";

  Object.entries(enumsStates).forEach(([key, value]) => {
    content += `${value} ${key} {\n  member${initializer || ""},\n${memberTwo ? "  memberTwo,\n" : ""}}\n\n`;
  });

  return content;
};

const printClient = (version: "v1" | "v2", name: string) => {
  let content = `import {\n`;
  Object.keys(enumsStates).forEach((state) => {
    content += `  ${state},\n`;
  });
  content += `} from "./${name}.${version}";\n\n`;

  Object.keys(enumsStates).forEach((key) => {
    content += `const ${key}Test = ${key}.member;\n`;
  });

  return content;
};

const printTest = (name: string, v2Content: string, v1Content?: string) => {
  const localCtx = `${context}/${name}`;

  if (!fs.existsSync(localCtx)) {
    fs.mkdirSync(localCtx);
  }

  files.forEach((f) => filenames.push(`${localCtx}/${name}.${f}`));
  contents.push(v1Content || printLibraryV1());
  contents.push(v2Content);
  contents.push(printClient("v1", name));
  contents.push(printClient("v2", name));
  testCount += 4;
};
const printAddInitializer = () => {
  const v2Content = Object.entries(enumsStates)
    .map(([key, value]) => {
      return `${value} ${key} {\n  member = "one",\n}\n`;
    })
    .join("\n");
  printTest("addInitializer", v2Content);
};

const printAddEnumMemberWithoutInitializer = () => {
  const v2Content = Object.entries(enumsStates)
    .map(([key, value]) => {
      return `${value} ${key} {\n  member,\n  memberTwo,\n}\n`;
    })
    .join("\n");
  printTest("addEnumMemberWithoutInitializer", v2Content);
};

const printAddEnumMemberWithInitializer = () => {
  const v2Content = Object.entries(enumsStates)
    .map(([key, value]) => {
      return `${value} ${key} {\n  member,\n  memberTwo = "two",\n}\n`;
    })
    .join("\n");
  printTest("addEnumMemberWithInitializer", v2Content);
};

const printChangeName = () => {
  const v2Content = Object.entries(enumsStates)
    .map(([key, value]) => {
      return `${value} ${key}NewName {\n  member,\n}\n`;
    })
    .join("\n");
  printTest("changeName", v2Content);
};

const printChangeInitializerNumberToString = () => {
  const v1Content = printLibraryV1(" = 1");
  const v2Content = Object.entries(enumsStates)
    .map(([key, value]) => {
      return `${value} ${key} {\n  member = "one",\n}\n`;
    })
    .join("\n");
  printTest("changeInitializerNumberToString", v2Content, v1Content);
};

const printChangeInitializerStringToNumber = () => {
  const v1Content = printLibraryV1(` = "one"`);
  const v2Content = Object.entries(enumsStates)
    .map(([key, value]) => {
      return `${value} ${key} {\n  member = 1,\n}\n`;
    })
    .join("\n");
  printTest("changeInitializerStringToNumber", v2Content, v1Content);
};

const printRemoveEnumMemberWithoutInitializer = () => {
  const v2Content = Object.entries(enumsStates)
    .map(([key, value]) => {
      return `${value} ${key} { }\n`;
    })
    .join("\n");
  printTest("removeEnumMemberWithoutInitializer", v2Content);
};

const printRemoveEnumMemberWithInitializer = () => {
  const v1Content = printLibraryV1(" = 1");
  const v2Content = Object.entries(enumsStates)
    .map(([key, value]) => {
      return `${value} ${key} { }\n`;
    })
    .join("\n");
  printTest("removeEnumMemberWithInitializer", v2Content, v1Content);
};

const printRemoveInitializer = () => {
  const v1Content = printLibraryV1(" = 1");
  const v2Content = Object.entries(enumsStates)
    .map(([key, value]) => {
      return `${value} ${key} {\n  member,\n}\n`;
    })
    .join("\n");
  printTest("removeInitializer", v2Content, v1Content);
};

const printTests = () => {
  printAddInitializer();
  printAddEnumMemberWithoutInitializer();
  printAddEnumMemberWithInitializer();
  printChangeName();
  printChangeInitializerNumberToString();
  printChangeInitializerStringToNumber();
  printRemoveEnumMemberWithoutInitializer();
  printRemoveEnumMemberWithInitializer();
  printRemoveInitializer();

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
