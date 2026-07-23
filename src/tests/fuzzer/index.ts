import { exec } from "child_process";
import { promisify } from "util";
import ts from "typescript";

export const BASE_PARAMS_DEF = `export interface SuperBaseParam {
  id: string;
  name?: string;
  metadata: { createdAt: Date; active: boolean; };
}


export interface BaseParam extends SuperBaseParam {
}


export interface ChildBaseParam extends BaseParam {
}

`;

export type TestCase = {
  name: string;
  v1Content: string;
  v2Content: string;
  v1Client: string;
  v2Client: string;
};

const execAsync = promisify(exec);

export async function runFandango(spec: string, seed: number): Promise<string> {
  const { stdout, stderr } = await execAsync(
    `fandango fuzz -f ${spec} -n 1 --random-seed ${seed}`,
  );

  if (stderr) {
    throw new Error(`Error executing fandango: ${stderr}`);
  }

  return stdout.trim();
}

export async function runFandangoParam(seed: number): Promise<string> {
  return await runFandango("param.spec", seed);
}

export async function runFandangoTypeAlgebra(seed: number): Promise<string> {
  return await runFandango("type-algebra.spec", seed);
}

export function isValidV2Type(
  fuzzedType: string,
  baseEntityCode: string,
): boolean {
  // Wrap the fuzzed type in a file with the BaseEntity
  const code = `${baseEntityCode}\n export type FuzzedV2 = ${fuzzedType};`;

  const sourceFile = ts.createSourceFile(
    "dummy.ts",
    code,
    ts.ScriptTarget.ES2022,
    true,
  );

  // Create an in-memory compiler host to check for semantic errors
  // Create an in-memory compiler host with the correct modern Node flags
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, // Fixes the undici-types error
    skipLibCheck: true, // Stops it from checking node_modules!
    noEmit: true,
  };

  const host = ts.createCompilerHost(compilerOptions);

  // Override getSourceFile to serve our in-memory string
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (fileName === "dummy.ts") return sourceFile;
    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };

  const program = ts.createProgram(["dummy.ts"], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  // If there are any errors (length > 0), the fuzzer generated invalid TS
  return diagnostics.length === 0;
}
