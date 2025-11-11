import { LogTransformResult } from '../logTransformer/types';

const PROMPT_HEADER = `You are Dev Analyzer, an assistant that reviews frontend build diagnostics and configuration to surface actionable insights.`;

export interface BuildPromptOptions {
  transform: LogTransformResult;
  additionalContext?: string;
}

export const buildBasePrompt = ({ transform, additionalContext }: BuildPromptOptions): string => {
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

  return sections.join('\n');
};

export const mergePrompts = (base: string, custom?: string): string => {
  if (!custom) return base;
  return `${base}\n\nUser instructions:\n${custom.trim()}`;
};
