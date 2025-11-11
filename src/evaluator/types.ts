import { LogTransformResult, LogMetrics, Issue } from '../logTransformer/types';

export interface ProjectFileSnapshot {
  path: string;
  exists: boolean;
  content?: string;
  reason?: string;
}

export interface PromptBundle {
  base: string;
  custom?: string;
  combined: string;
}

export interface LoadEvaluationContextOptions {
  cwd?: string;
  transform: LogTransformResult;
  customPrompt?: string;
  includeConfigs?: string[];
}

export interface EvaluationContext {
  cwd: string;
  framework: string;
  metrics: LogMetrics;
  transform: LogTransformResult;
  prompt: PromptBundle;
  configFiles: ProjectFileSnapshot[];
  relatedFiles: ProjectFileSnapshot[];
}

export type RecommendationLevel = 'info' | 'warning' | 'critical';

export interface Recommendation {
  level: RecommendationLevel;
  message: string;
  details?: Record<string, unknown>;
}

export interface Thresholds {
  warningPenalty: number;
  errorPenalty: number;
  slowBuildMs: number;
}

export interface EvaluateOptions {
  thresholds?: Partial<Thresholds>;
}

export interface EvaluationResult {
  score: number;
  level: 'Excellent' | 'Good' | 'Average' | 'Poor';
  summary: string;
  recommendations: Recommendation[];
  issues: Issue[];
  context: EvaluationContext;
}
