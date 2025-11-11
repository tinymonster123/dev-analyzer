export interface DetectManagerOptions {
  cwd?: string;
}

export type PackageManager = 'pnpm' | 'yarn' | 'npm' | 'bun' | 'unknown';

export interface DetectManagerResult {
  packageManager: PackageManager;
  framework: {
    name: string;
    version: string | null;
  };
}

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  packageManager?: string;
}

export interface FrameworkCandidate {
  name: string;
  packageNames: string[];
}
