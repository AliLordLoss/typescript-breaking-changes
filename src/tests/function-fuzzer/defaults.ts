import { exec } from "child_process";
import { promisify } from "util";
import { generateClientArguments } from "./ts-utilities";

export const functionStates = {
  export: "export ",
  exportAsync: "export async ",
  exportDefault: "export default ",
  exportDefaultAsync: "export default async ",
};

export const functionStateKeys = Object.keys(
  functionStates,
) as (keyof typeof functionStates)[];

const defaultFunctionStateKeys: (keyof typeof functionStates)[] = [
  "exportDefault",
  "exportDefaultAsync",
];

export const isDefaultState = (key: keyof typeof functionStates) =>
  defaultFunctionStateKeys.includes(key);

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

export const genParam = async (seed: number): Promise<string> => {
  try {
    const result = await runFandangoParam(seed);
    return result;
  } catch (error) {
    console.error(error);
    return "";
  }
};

export const genFn = async (fnName: string, seed: number) => {
  const fnParam = await genParam(seed); // e.g., "a: string | number, ...b: boolean[]"
  const mockArgs = generateClientArguments(fnParam); // returns ["'mock_string'", "...[true]"]

  return {
    declaration: `function ${fnName}(${fnParam}){  }\n`,
    clientCallArgs: mockArgs,
    name: fnName,
    params: fnParam,
  };
};
