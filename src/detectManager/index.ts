import { promises as fs } from 'fs';
import path from 'path';

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

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  packageManager?: string;
}

interface FrameworkCandidate {
  name: string;
  packageNames: string[];
}

const UNKNOWN_FRAMEWORK = 'Unknown';
const UNKNOWN_MANAGER: PackageManager = 'unknown';

const FRAMEWORK_CANDIDATES: FrameworkCandidate[] = [
  { name: 'Next.js', packageNames: ['next'] },
  { name: 'Nuxt', packageNames: ['nuxt', '@nuxt/kit'] },
  { name: 'Vite', packageNames: ['vite'] },
  { name: 'Angular', packageNames: ['@angular/core'] },
  { name: 'SvelteKit', packageNames: ['@sveltejs/kit'] },
  { name: 'Astro', packageNames: ['astro'] },
  { name: 'Gatsby', packageNames: ['gatsby'] },
  { name: 'Remix', packageNames: ['@remix-run/dev', '@remix-run/node'] },
  { name: 'Vue CLI', packageNames: ['@vue/cli-service'] },
  { name: 'Create React App', packageNames: ['react-scripts'] },
  { name: 'Expo', packageNames: ['expo'] },
];

const LOCKFILE_CANDIDATES: Array<{ filename: string; manager: Exclude<PackageManager, 'unknown'> }> = [
  { filename: 'pnpm-lock.yaml', manager: 'pnpm' },
  { filename: 'pnpm-lock.yml', manager: 'pnpm' },
  { filename: 'yarn.lock', manager: 'yarn' },
  { filename: 'package-lock.json', manager: 'npm' },
  { filename: 'npm-shrinkwrap.json', manager: 'npm' },
  { filename: 'bun.lockb', manager: 'bun' },
];

/**
 * 读取项目的包管理器与主要框架信息。
 * - 框架通过依赖包名匹配。
 * - 包管理器优先读取 package.json 的 packageManager 字段，其次检查锁文件。
 */
export const detectManager = async (
  options: DetectManagerOptions = {}
): Promise<DetectManagerResult> => {
  const cwd = options.cwd ?? process.cwd();
  const manifest = await loadPackageManifest(cwd);
  const dependencies = aggregateDependencies(manifest);

  const frameworkMatch = detectFramework(dependencies);
  const packageManager = await detectPackageManager(cwd, manifest);

  return {
    packageManager,
    framework: {
      name: frameworkMatch?.name ?? UNKNOWN_FRAMEWORK,
      version: frameworkMatch?.version ?? null,
    },
  };
};

/**
 * 根据依赖映射识别主要框架。
 * 返回框架名称和清洗后的版本号，若未匹配则返回 null。
 */
const detectFramework = (
  dependencies: Map<string, string>
): { name: string; version: string | null } | null => {
  for (const candidate of FRAMEWORK_CANDIDATES) {
    const match = candidate.packageNames.find((pkg) => dependencies.has(pkg));
    if (match) {
      return {
        name: candidate.name,
        version: normalizeVersion(dependencies.get(match) ?? ''),
      };
    }
  }

  return null;
};

/**
 * 基于 package.json 中的 packageManager 字段与锁文件推断包管理工具。
 */
const detectPackageManager = async (
  root: string,
  manifest: PackageJson | null
): Promise<PackageManager> => {
  const manifestManager = parsePackageManagerField(manifest?.packageManager);
  if (manifestManager) {
    return manifestManager;
  }

  for (const candidate of LOCKFILE_CANDIDATES) {
    if (await fileExists(path.join(root, candidate.filename))) {
      return candidate.manager;
    }
  }

  return UNKNOWN_MANAGER;
};

/**
 * 解析 packageManager 字段，提取包管理器名称。
 */
const parsePackageManagerField = (value?: string): PackageManager | null => {
  if (!value) return null;
  const name = value.split('@')[0];

  switch (name) {
    case 'pnpm':
    case 'yarn':
    case 'npm':
    case 'bun':
      return name;
    default:
      return null;
  }
};

/**
 * 读取指定目录的 package.json，若不存在则返回 null。
 */
const loadPackageManifest = async (root: string): Promise<PackageJson | null> => {
  const manifestPath = path.join(root, 'package.json');

  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
};

/**
 * 汇总多个依赖段为一个 Map，方便后续查询。
 */
const aggregateDependencies = (manifest: PackageJson | null): Map<string, string> => {
  const result = new Map<string, string>();
  if (!manifest) {
    return result;
  }

  const sections: Array<keyof PackageJson> = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  for (const section of sections) {
    const deps = manifest[section];
    if (!deps) continue;

    for (const [name, version] of Object.entries(deps)) {
      if (!result.has(name)) {
        result.set(name, version);
      }
    }
  }

  return result;
};

/**
 * 判断文件是否存在。
 */
const fileExists = async (target: string): Promise<boolean> => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

/**
 * 规范化版本号：移除前缀标记并提取语义化版本片段。
 */
const normalizeVersion = (version: string): string | null => {
  if (!version) return null;
  if (version.startsWith('workspace:')) {
    return version.slice('workspace:'.length) || null;
  }

  const cleaned = version.replace(/^[\^~><=\s]*/, '');
  const match = cleaned.match(/(\d+\.[\dA-Za-z.-]+(?:\.[\dA-Za-z.-]+)?)/);

  return match ? match[1] : cleaned || null;
};

