export const PROMPT_HEADER =
  'You are Dev Analyzer, an assistant that reviews frontend build diagnostics and configuration to surface actionable insights.';

export const DEFAULT_LLM_MODEL = 'gpt-4o-mini';
export const DEFAULT_LLM_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export const COMMON_CONFIGS: string[] = [
  'package.json',
  'tsconfig.json',
  'tailwind.config.js',
  'tailwind.config.ts',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
];

export const FRAMEWORK_CONFIG_MAP: Record<string, string[]> = {
  next: ['next.config.js', 'next.config.ts', 'next.config.mjs', 'next.config.cjs'],
  vite: ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs'],
  nuxt: ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs', 'nuxt.config.cjs'],
  gatsby: ['gatsby-config.js', 'gatsby-config.ts'],
  astro: ['astro.config.ts', 'astro.config.js'],
};

export const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200 KB
export const MAX_FILE_CHARS = 40_000;

export const ISSUE_PATH_REGEX =
  /(?:\.|\/)(?:[\w.-]+\/(?:[\w.-]+\/)*[\w.-]+\.[\w]+)|(?:src|app|pages)\/[\w./-]+\.[\w]+/gi;
