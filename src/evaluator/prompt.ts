import { LogTransformResult } from '../logTransformer/types';
import { EvaluationContext, PromptBundle, Recommendation } from './types';
import { PROMPT_HEADER } from './constants';

export const createPromptBundle = (
  transform: LogTransformResult,
  customPrompt?: string,
  additionalContext?: string
): PromptBundle => {
  const { framework, metrics } = transform;
  const errorCount = metrics.errors.length;
  const warningCount = metrics.warnings.length;
  const longest = Number(metrics.summary?.longestBuildMs ?? 0);

  const summaryLines = [
    `Framework: ${framework || 'Unknown'}`,
    `Errors detected: ${errorCount}`,
    `Warnings detected: ${warningCount}`,
    `Build events recorded: ${metrics.buildEvents.length}`,
    longest ? `Longest build duration: ${longest} ms` : null,
  ].filter(Boolean);

  const sections: string[] = [PROMPT_HEADER, '', summaryLines.join('\n')];

  if (metrics.errors.length) {
    sections.push('', 'Key errors:', ...metrics.errors.map((issue) => `- ${issue.message}`));
  }

  if (metrics.warnings.length) {
    sections.push('', 'Key warnings:', ...metrics.warnings.slice(0, 5).map((issue) => `- ${issue.message}`));
    if (metrics.warnings.length > 5) {
      sections.push(`- ...(total ${metrics.warnings.length} warnings)`);
    }
  }

  if (additionalContext) {
    sections.push('', additionalContext.trim());
  }

  const base = sections.join('\n');
  const combined = customPrompt ? `${base}\n\nUser instructions:\n${customPrompt.trim()}` : base;

  return {
    base,
    custom: customPrompt,
    combined,
  };
};

export const buildLlmPrompt = (
  context: EvaluationContext,
  recommendations: Recommendation[]
): string => {
  const { metrics } = context.transform;

  const issues = [...metrics.errors, ...metrics.warnings]
    .map((issue) => `- [${issue.level.toUpperCase()}] ${issue.message}`)
    .join('\n');

  return [
    context.prompt.combined,
    '',
    '构建事件概览：',
    metrics.buildEvents
      .map(
        (event) =>
          `- ${event.target} | ${event.type} | ${event.durationMs ?? 'N/A'} ms | modules: ${event.modules ?? 'N/A'}`
      )
      .join('\n'),
    '',
    '识别到的问题：',
    issues || '- 无',
    '',
    recommendations.length ? `已有建议数量：${recommendations.length}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};
