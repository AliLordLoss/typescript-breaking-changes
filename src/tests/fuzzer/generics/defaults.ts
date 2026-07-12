export const BASE_PARAM_DEF = `export interface BaseParam {
  id: string;
  name?: string;
  metadata: { createdAt: Date; active: boolean; };
}

`;

export type TestCase = {
  name: string;
  v1Content: string;
  v2Content: string;
  v1Client: string;
  v2Client: string;
};
