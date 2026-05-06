export type GenMode = 'fast' | 'full';

export interface GenOptions {
  mode: GenMode;
  signal?: AbortSignal;
}

export interface ModuleMeta {
  files: string[];
  hash: string;
  lastGen: string;
  lastCommit: string;
}

export interface RawMeta {
  version: number;
  modules: Record<string, ModuleMeta>;
  config: {
    tokenBudget: number;
    stalenessDays: number;
  };
}
