import { promises as fs } from 'fs';
import path from 'path';
import { createPromptBundle } from './prompt';
import {
  LoadEvaluationContextOptions,
  EvaluationContext,
  ProjectFileSnapshot,
  EvaluationResult,
  EvaluateOptions,
  Recommendation,
  Thresholds,
} from './types';
import { Issue, LogMetrics, LogTransformResult } from '../logTransformer/types';
import { generateLlmInsights } from './llm';
import {
  COMMON_CONFIGS,
  FRAMEWORK_CONFIG_MAP,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_CHARS,
  ISSUE_PATH_REGEX,
} from './constants';

export const loadEvaluationContext = async (
  options: LoadEvaluationContextOptions
): Promise<EvaluationContext> => {
  const { transform, customPrompt } = options;
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const configCandidates = resolveConfigCandidates(transform.framework, options.includeConfigs);
  const configFiles = await readProjectFiles(cwd, configCandidates);
  const relatedPaths = extractRelatedPaths(transform.metrics, configCandidates);
  const relatedFiles = await readProjectFiles(cwd, relatedPaths);

  const promptBundle = createPromptBundle(transform, customPrompt);

  return {
    cwd,
    framework: transform.framework,
    metrics: transform.metrics,
    transform,
    prompt: promptBundle,
    configFiles,
    relatedFiles,
  };
};

export const evaluate = async (
  context: EvaluationContext,
  options: EvaluateOptions = {}
): Promise<EvaluationResult> => {
  const { metrics } = context;
  const thresholds: Thresholds = {
    warningPenalty: 5,
    errorPenalty: 20,
    slowBuildMs: 30_000,
    ...(options.thresholds ?? {}),
  };

  let score = 100;
  score -= metrics.errors.length * thresholds.errorPenalty;
  score -= metrics.warnings.length * thresholds.warningPenalty;

  const longestBuild = Number(metrics.summary?.longestBuildMs ?? 0);
  if (longestBuild && longestBuild > thresholds.slowBuildMs) {
    score -= Math.min(30, Math.ceil((longestBuild - thresholds.slowBuildMs) / 10_000) * 5);
  }

  score = Math.max(0, Math.min(100, score));

  const level = deriveLevel(score);
  const recommendations = buildRecommendations(context, thresholds);
  const summary = buildSummary(metrics, score, longestBuild);
  const issues = [...metrics.errors, ...metrics.warnings];

  const llmSummary = await generateLlmInsights(context, recommendations, options.llm);

  return {
    score,
    level,
    summary,
    recommendations,
    issues,
    context,
    llm: llmSummary ?? undefined,
  };
};

const deriveLevel = (score: number): EvaluationResult['level'] => {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  return 'Poor';
};

const buildSummary = (metrics: LogMetrics, score: number, longestBuild: number): string => {
  const parts: string[] = [
    `Score ${score}/100`,
    `Errors ${metrics.errors.length}`,
    `Warnings ${metrics.warnings.length}`,
  ];

  if (metrics.buildEvents.length) {
    parts.push(`Build events ${metrics.buildEvents.length}`);
  }

  if (longestBuild) {
    parts.push(`Longest build ${longestBuild} ms`);
  }

  return parts.join(' · ');
};

const buildRecommendations = (
  context: EvaluationContext,
  thresholds: Thresholds
): Recommendation[] => {
  const recommendations: Recommendation[] = [];
  const { metrics, configFiles } = context;

  for (const error of metrics.errors) {
    recommendations.push({ level: 'critical', message: error.message, details: error.details });
  }

  for (const warning of metrics.warnings) {
    recommendations.push({ level: 'warning', message: warning.message, details: warning.details });
  }

  const longest = Number(metrics.summary?.longestBuildMs ?? 0);
  if (longest && longest > thresholds.slowBuildMs) {
    recommendations.push({
      level: 'warning',
      message: `Build step耗时 ${longest} ms，超过阈值 ${thresholds.slowBuildMs} ms，建议检查懒加载、缓存或代码拆分。`,
      details: { longestBuildMs: longest },
    });
  }

  const missingConfigs = configFiles.filter((file) => !file.exists);
  if (missingConfigs.length) {
    recommendations.push({
      level: 'info',
      message: `未找到部分配置文件：${missingConfigs.map((file) => file.path).join(', ')}`,
    });
  }

  return recommendations;
};

const resolveConfigCandidates = (framework: string, include?: string[]): string[] => {
  const normalized = framework.toLowerCase();
  const candidates = new Set<string>(COMMON_CONFIGS);

  for (const [key, files] of Object.entries(FRAMEWORK_CONFIG_MAP)) {
    if (normalized.includes(key)) {
      files.forEach((file) => candidates.add(file));
    }
  }

  include?.forEach((file) => candidates.add(file));
  return Array.from(candidates);
};

const readProjectFiles = async (root: string, paths: string[]): Promise<ProjectFileSnapshot[]> => {
  const snapshots: ProjectFileSnapshot[] = [];

  for (const relative of [...new Set(paths)]) {
    const snapshot = await readProjectFile(root, relative);
    snapshots.push(snapshot);
  }

  return snapshots;
};

const readProjectFile = async (root: string, relativePath: string): Promise<ProjectFileSnapshot> => {
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root)) {
    return { path: relativePath, exists: false, reason: 'Path escapes project root' };
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      return { path: relativePath, exists: false, reason: 'Not a regular file' };
    }

    if (stat.size > MAX_FILE_SIZE_BYTES) {
      const content = await fs.readFile(resolved, 'utf8');
      return {
        path: relativePath,
        exists: true,
        content: content.slice(0, MAX_FILE_CHARS) + '\n...[truncated]',
        reason: `File truncated from ${stat.size} bytes`,
      };
    }

    const content = await fs.readFile(resolved, 'utf8');
    return { path: relativePath, exists: true, content };
  } catch (error) {
    return { path: relativePath, exists: false, reason: (error as Error).message };
  }
};

const extractRelatedPaths = (metrics: LogMetrics, existingCandidates: string[]): string[] => {
  const fromIssues = extractPathsFromIssues([...metrics.errors, ...metrics.warnings]);
  const deduped = new Set<string>();

  for (const candidate of fromIssues) {
    if (!existingCandidates.includes(candidate)) {
      deduped.add(candidate);
    }
  }

  return Array.from(deduped);
};

const extractPathsFromIssues = (issues: Issue[]): string[] => {
  const paths = new Set<string>();

  for (const issue of issues) {
    const matches = issue.message.match(ISSUE_PATH_REGEX) ?? [];
    matches.forEach((match) => {
      const normalized = normalizeIssuePath(match);
      if (normalized) {
        paths.add(normalized);
      }
    });

    if (issue.details) {
      Object.values(issue.details).forEach((value) => {
        if (typeof value === 'string') {
          const detailMatches = value.match(ISSUE_PATH_REGEX) ?? [];
          detailMatches.forEach((match) => {
            const normalized = normalizeIssuePath(match);
            if (normalized) {
              paths.add(normalized);
            }
          });
        }
      });
    }
  }

  return Array.from(paths);
};

const normalizeIssuePath = (segment: string): string | null => {
  const cleaned = segment.replace(/^[-\s]+/, '').replace(/^[.:]+/, '');
  const trimmed = cleaned.startsWith('/') ? cleaned.slice(1) : cleaned;
  if (!trimmed) {
    return null;
  }
  return trimmed;
};

export * from './types';
