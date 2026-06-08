import fs from "fs";
import fsPromise from "fs/promises";
import path from "path";
import pLimit from "p-limit";
import {
  baseClassStateKeys,
  baseClassStates,
  ClientOptions,
  genBaseClass,
  genClient,
  genDerivedClass,
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
  const baseOptionKeys = [
    "withConstructor",
    "withPrivateMethod",
    "withPrivateProperty",
  ] as const;
  const baseDefault = {
    withConstructor: false,
    withPrivateMethod: false,
    withPrivateProperty: false,
  };

  const derivedVariantsByHeritage = {
    extends: [
      {
        options: { withConstructor: false, withOverride: false },
        name: "Minimal",
      },
    ],
    implements: [
      {
        options: { withConstructor: false, withOverride: true },
        name: "WithOverride",
      },
    ],
  } as const;

  // first: state-based base-class permutations (keep client variants minimal)
  for (const baseClassStateKey of baseClassStateKeys) {
    for (const nextBaseClassStateKey of baseClassStateKeys) {
      if (baseClassStateKey === nextBaseClassStateKey) continue;

      for (const heritage of ["extends", "implements"] as const) {
        for (const {
          options: derivedOptions,
          name: derivedName,
        } of derivedVariantsByHeritage[heritage]) {
          const testName = `changeBaseClass_${baseClassStateKey}_to_${nextBaseClassStateKey}_${heritage}_${derivedName}`;
          const derivedClass = genDerivedClass(heritage, derivedOptions);

          const v1Content = `${baseClassStates[baseClassStateKey]}${genBaseClass(
            {
              withConstructor: false,
              withPrivateMethod: false,
              withPrivateProperty: false,
            },
            baseClassStateKey.toLowerCase().includes("declare"),
          )}\n${derivedClass}`;
          const v2Content = `${baseClassStates[nextBaseClassStateKey]}${genBaseClass(
            {
              withConstructor: false,
              withPrivateMethod: false,
              withPrivateProperty: false,
            },
            nextBaseClassStateKey.toLowerCase().includes("declare"),
          )}\n${derivedClass}`;

          const clientVariants: {
            clientOptions: ClientOptions | null;
            label: string;
          }[] = [
            { clientOptions: null, label: "instantiation" },
            {
              clientOptions: {
                heritage: "extends",
                modifier: "public",
                constructor: true,
                override: true,
                method: "same",
                property: "same",
              },
              label: "max_ext",
            },
            {
              clientOptions: {
                heritage: "implements",
                modifier: "public",
                constructor: true,
                override: true,
                method: "same",
                property: "same",
              },
              label: "max_impl",
            },
          ];

          for (const { clientOptions, label } of clientVariants) {
            const effectiveClientOptions = clientOptions
              ? { ...clientOptions }
              : null;
            const { client } = genClient(effectiveClientOptions);
            const clientNameBase = `${testName}.${label}`;
            printTest(
              clientNameBase,
              v1Content,
              v2Content,
              client.replace("%importaddr%", `${clientNameBase}.v1`),
              client.replace("%importaddr%", `${clientNameBase}.v2`),
            );
            testCount++;
          }
        }
      }
    }
  }

  // second: single-option changes in Base class (isolate each option)
  for (const key of baseOptionKeys) {
    const variants = [
      {
        v1Options: { ...baseDefault, [key]: true },
        v2Options: baseDefault,
        direction: "Removed",
      },
      {
        v1Options: baseDefault,
        v2Options: { ...baseDefault, [key]: true },
        direction: "Added",
      },
    ];

    for (const { v1Options, v2Options, direction } of variants) {
      for (const heritage of ["extends", "implements"] as const) {
        for (const {
          options: derivedOptions,
          name: derivedName,
        } of derivedVariantsByHeritage[heritage]) {
          const keyName = key.replace("with", "");
          const testName = `changeBaseClass_${keyName}_${direction}_${heritage}_${derivedName}`;
          const derivedClass = genDerivedClass(heritage, derivedOptions);

          // skip invalid combos
          if (
            heritage === "implements" &&
            (!derivedOptions.withOverride ||
              v1Options.withPrivateMethod ||
              v1Options.withPrivateProperty)
          )
            continue;

          const v1Content = `${genBaseClass(v1Options, false)}\n${derivedClass}`;
          const v2Content = `${genBaseClass(v2Options, false)}\n${derivedClass}`;

          const baseHasPrivate =
            v1Options.withPrivateMethod || v1Options.withPrivateProperty;

          const clientVariants: {
            clientOptions: ClientOptions | null;
            label: string;
          }[] = [
            { clientOptions: null, label: "instantiation" },
            {
              clientOptions: {
                heritage: "extends",
                modifier: "public",
                constructor: true,
                override: true,
                method: "same",
                property: "same",
              },
              label: "max_ext",
            },
            {
              clientOptions: {
                heritage: "implements",
                modifier: "public",
                constructor: true,
                override: true,
                method: "same",
                property: "same",
              },
              label: "max_impl",
            },
          ];

          for (const { clientOptions, label } of clientVariants) {
            const effectiveClientOptions = clientOptions
              ? { ...clientOptions }
              : null;

            // adjust maximal client to ensure it compiles under v1
            if (effectiveClientOptions) {
              if (
                v1Options.withPrivateMethod &&
                effectiveClientOptions.method === "same"
              )
                effectiveClientOptions.method = "different";
              if (
                v1Options.withPrivateProperty &&
                effectiveClientOptions.property === "same"
              )
                effectiveClientOptions.property = "different";
              if (
                baseHasPrivate &&
                effectiveClientOptions.heritage === "implements"
              )
                continue;
            }

            const { client } = genClient(effectiveClientOptions);
            const clientNameBase = `${testName}.${label}`;
            printTest(
              clientNameBase,
              v1Content,
              v2Content,
              client.replace("%importaddr%", `${clientNameBase}.v1`),
              client.replace("%importaddr%", `${clientNameBase}.v2`),
            );
            testCount++;
          }
        }
      }
    }
  }
};

const printTests = async () => {
  printChangeBaseClass();

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
