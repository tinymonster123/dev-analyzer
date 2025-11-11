import { FrameworkCandidate, PackageManager } from './types';

export const UNKNOWN_FRAMEWORK = 'Unknown';
export const UNKNOWN_MANAGER: PackageManager = 'unknown';

export const FRAMEWORK_CANDIDATES: FrameworkCandidate[] = [
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

export const LOCKFILE_CANDIDATES: Array<{ filename: string; manager: Exclude<PackageManager, 'unknown'> }> = [
  { filename: 'pnpm-lock.yaml', manager: 'pnpm' },
  { filename: 'pnpm-lock.yml', manager: 'pnpm' },
  { filename: 'yarn.lock', manager: 'yarn' },
  { filename: 'package-lock.json', manager: 'npm' },
  { filename: 'npm-shrinkwrap.json', manager: 'npm' },
  { filename: 'bun.lockb', manager: 'bun' },
];
