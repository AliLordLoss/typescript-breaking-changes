import { exec } from "child_process";
import { promisify } from "util";

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

export const isDefaultState = (key: string) =>
  defaultFunctionStateKeys.includes(key as keyof typeof functionStates);

type ParamState =
  | "none"
  | "noOperator"
  | "dotdotdot"
  | "questionToken"
  | "initializer";

export const paramStates: ParamState[] = [
  "none",
  "noOperator",
  "dotdotdot",
  "questionToken",
  "initializer",
];

const clientUseWithParamStateList: ParamState[] = [
  "noOperator",
  "dotdotdot",
  "questionToken",
  "initializer",
];

const clientUseWithoutParamStateList: ParamState[] = [
  "none",
  "dotdotdot",
  "questionToken",
  "initializer",
];

export const isUsedWithParam = (key: ParamState) =>
  clientUseWithParamStateList.includes(key);
export const isUsedWithMoreParams = (key: ParamState) => key === "dotdotdot";
export const isUsedWithoutParam = (key: ParamState) =>
  clientUseWithoutParamStateList.includes(key);

const execAsync = promisify(exec);

async function runFandangoParam(): Promise<string> {
  const { stdout, stderr } = await execAsync(
    "fandango fuzz -f param.spec -n 1",
  );

  if (stderr) {
    throw new Error(`Error executing fandango: ${stderr}`);
  }

  return stdout.trim();
}

const genParam = async (): Promise<string> => {
  // switch (param) {
  //   case "noOperator":
  //     return `${paramName}:number`;
  //   case "dotdotdot":
  //     return `...${paramName}:number[]`;
  //   case "questionToken":
  //     return `${paramName}?:number`;
  //   case "initializer":
  //     return `${paramName}:number = 1`;
  //   case "none":
  //     return "";
  // }

  try {
    const result = await runFandangoParam();
    return result;
  } catch (error) {
    console.error(error);
    return "";
  }
};

export const genFn = async (fnName: string = "a") => {
  const fnParam = await genParam();

  return `function ${fnName}(${fnParam}){  }\n`;
};
