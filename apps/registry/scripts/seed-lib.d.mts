export declare const FIXTURES: Array<Record<string, unknown> & { n: string; v: string; c: string }>;
export declare function buildSeed(opts: {
  keyId: string;
  privateKey: string;
  publicKey?: string;
  manifests?: object[];
  now?: number;
  offset?: number;
  rulesFor?: (m: object) => string;
}): Promise<string[]>;
