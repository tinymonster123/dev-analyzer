import { EvaluationResult, Recommendation } from '../evaluator/types';

export interface TextReportOptions {
  verbose?: boolean;
}

export interface JsonReportOptions {
  cwd?: string;
  outputPath?: string;
  includeRawLogs?: boolean;
  includeConfigFiles?: boolean;
  includeRelatedFiles?: boolean;
  pretty?: boolean | number;
}

export interface JsonReportPayload {
  generatedAt: string;
  score: number;
  level: EvaluationResult['level'];
  summary: string;
  recommendations: Recommendation[];
  issues: EvaluationResult['issues'];
  framework: string;
  metrics: EvaluationResult['context']['transform']['metrics'];
  prompt: {
    base: string;
    custom?: string;
  };
  configFiles?: EvaluationResult['context']['configFiles'];
  relatedFiles?: EvaluationResult['context']['relatedFiles'];
  rawLogs?: EvaluationResult['context']['transform']['rawLogs'];
  llm?: {
    summary: string;
    provider: string;
    model: string;
  };
}
