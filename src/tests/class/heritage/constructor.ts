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
  genBaseClassWithoutMethod,
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
            const { client } = genClient(effectiveClientOptions, false);
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
                baseHasPrivate &&
                effectiveClientOptions.heritage === "implements"
              )
                continue;

              if (
                v1Options.withPrivateMethod &&
                effectiveClientOptions.method === "same"
              )
                effectiveClientOptions.method = "none";
              if (
                v1Options.withPrivateProperty &&
                effectiveClientOptions.property === "same"
              )
                effectiveClientOptions.property = "none";
            }

            const { client } = genClient(effectiveClientOptions, false);
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

const printChangeInheritance = () => {
  const directions = ["Added", "Removed"] as const;
  const heritages = ["extends", "implements"] as const;

  for (const direction of directions) {
    for (const heritage of heritages) {
      const baseVariants = [{ withPrivateMethod: false, name: "Empty" }];

      // TypeScript does not allow implementing a class with private members unless you extend it,
      // so we only test private members for 'extends'.
      if (heritage === "extends") {
        baseVariants.push({
          withPrivateMethod: true,
          name: "WithPrivate",
        });
      }

      for (const baseVariant of baseVariants) {
        const testName = `changeInheritance_${direction}_${heritage}_${baseVariant.name}`;
        const baseContent = genBaseClassWithoutMethod(
          baseVariant.withPrivateMethod,
        );

        // Generate the with/without strings
        const derivedWith = genDerivedClass(heritage, {
          withConstructor: false,
          withOverride: false,
        });
        // Cleanly strip the inheritance keyword to generate the 'without' variant
        const derivedWithout = derivedWith.replace(` ${heritage} Base`, "");

        const v1Derived = direction === "Added" ? derivedWithout : derivedWith;
        const v2Derived = direction === "Added" ? derivedWith : derivedWithout;

        const v1Content = `${baseContent}\n${v1Derived}`;
        const v2Content = `${baseContent}\n${v2Derived}`;

        const clientVariants: {
          clientOptions: ClientOptions | null;
          label: string;
        }[] = [
          { clientOptions: null, label: "instantiation" },
          {
            clientOptions: {
              heritage: "extends",
              modifier: "public",
              constructor: false,
              override: false,
              method: "none",
              property: "none",
            },
            label: "extends",
          },
          {
            clientOptions: {
              heritage: "implements",
              modifier: "public",
              constructor: false,
              override: false,
              method: "none",
              property: "none",
            },
            label: "implements",
          },
          // A client that happens to declare a private method with the same name
          {
            clientOptions: {
              heritage: "extends",
              modifier: "private",
              constructor: false,
              override: false,
              method: "same",
              property: "none",
            },
            label: "extends_conflict",
          },
        ];

        for (const { clientOptions, label } of clientVariants) {
          if (clientOptions) {
            const baseHasPrivate = baseVariant.name === "WithPrivate";
            const isV1Inheriting = direction === "Removed";

            // Guard: V1 must compile for it to be a valid test.
            // A client cannot "implement" a class that has private members.
            if (
              clientOptions.heritage === "implements" &&
              baseHasPrivate &&
              isV1Inheriting
            ) {
              continue;
            }

            // Guard: If V1 already inherits the private method, the client cannot declare a conflicting private method in V1.
            if (
              clientOptions.method === "same" &&
              baseHasPrivate &&
              isV1Inheriting
            ) {
              continue;
            }
          }

          const { client } = genClient(clientOptions, true);
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
};

const printTests = async () => {
  printChangeBaseClass();
  printChangeInheritance();

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
