export interface SourceModule {
  id: string;
  path: string;
  relativePath: string;
  files: SourceFile[];
  children: SourceModule[];
}

export interface SourceFile {
  relativePath: string;
  extension: string;
  size: number;
}

export interface ScanResult {
  modules: SourceModule[];
  rootFiles: SourceFile[];
}

export interface RawConfig {
  version: number;
  tokenBudget: number;
  stalenessDays: number;
  modules: {
    include: string[];
    exclude: string[];
  };
  moduleOverrides: Record<string, string>;
}

export const DEFAULT_CONFIG: RawConfig = {
  version: 1,
  tokenBudget: 800,
  stalenessDays: 7,
  modules: { include: ['*'], exclude: [] },
  moduleOverrides: {},
};

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
