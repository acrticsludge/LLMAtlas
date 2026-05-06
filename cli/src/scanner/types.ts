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
  model: {
    fast: { provider: string; model: string } | null;
    full: { provider: string; model: string } | null;
  };
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
  model: { fast: null, full: null },
  modules: { include: ['*'], exclude: [] },
  moduleOverrides: {},
};
