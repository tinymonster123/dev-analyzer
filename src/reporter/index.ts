import { promises as fs } from 'fs';
import path from 'path';
import { EvaluationResult } from '../evaluator/types';
import { ConsoleReportOptions, JsonReportOptions, JsonReportPayload } from './types';
import {
  COLOR_RESET,
  COLOR_BOLD,
  COLOR_DIM,
  COLOR_GREEN,
  COLOR_YELLOW,
  COLOR_RED,
  COLOR_CYAN,
  DEFAULT_REPORT_DIR,
  DEFAULT_REPORT_FILENAME,
  LEVEL_COLOR_MAP,
  RECOMMENDATION_COLOR_MAP,
} from './constants';

const NEWLINE = '\n';

export const renderConsoleReport = (
  result: EvaluationResult,
  options: ConsoleReportOptions = {}
): string => {
  const { context } = result;
  const useColor = options.useColor ?? process.stdout.isTTY;
  const indent = ' '.repeat(options.indent ?? 2);

  const colorize = (color: string, value: string) => (useColor ? `${color}${value}${COLOR_RESET}` : value);
  const bold = (value: string) => (useColor ? `${COLOR_BOLD}${value}${COLOR_RESET}` : value);
  const dim = (value: string) => (useColor ? `${COLOR_DIM}${value}${COLOR_RESET}` : value);

  const header = bold('Dev Analyzer Report');
  const scoreColor = LEVEL_COLOR_MAP[result.level] ?? COLOR_GREEN;
  const scoreLine = `${bold('Score')}: ${colorize(scoreColor, `${result.score}/100`)} (${result.level})`;

  const lines: string[] = [header, `${bold('Framework')}: ${context.framework || 'Unknown'}`, scoreLine];
  lines.push(`${bold('Summary')}: ${result.summary}`);

  if (context.metrics.buildEvents.length) {
    const longest = Number(context.metrics.summary?.longestBuildMs ?? 0);
    const longestLine = longest ? `Longest build: ${longest} ms` : null;
    const buildLine = `Build events: ${context.metrics.buildEvents.length}`;
    lines.push(`${bold('Build')}: ${buildLine}${longestLine ? ` · ${longestLine}` : ''}`);
  }

  if (result.recommendations.length) {
    lines.push('', bold('Recommendations:'));
    result.recommendations.forEach((rec) => {
      const color = RECOMMENDATION_COLOR_MAP[rec.level] ?? COLOR_CYAN;
      lines.push(`${indent}${colorize(color, `[${rec.level.toUpperCase()}]`)} ${rec.message}`);
    });
  }

  if (result.llm?.summary) {
    lines.push('', bold('LLM Insights:'));
    result.llm.summary.split(/\r?\n/).forEach((line) => {
      lines.push(`${indent}${line}`);
    });
  }

  if (options.verbose) {
    lines.push('', bold('Config files:'));
    context.configFiles.forEach((file) => {
      const statusColor = file.exists ? COLOR_GREEN : COLOR_YELLOW;
      const statusLabel = file.exists ? 'found' : 'missing';
      lines.push(
        `${indent}${colorize(statusColor, statusLabel.padEnd(8))} ${file.path}${
          file.reason ? dim(` (${file.reason})`) : ''
        }`
      );
    });

    if (context.relatedFiles.length) {
      lines.push('', bold('Related files:'));
      context.relatedFiles.forEach((file) => {
        const statusColor = file.exists ? COLOR_GREEN : COLOR_YELLOW;
        const statusLabel = file.exists ? 'found' : 'missing';
        lines.push(
          `${indent}${colorize(statusColor, statusLabel.padEnd(8))} ${file.path}${
            file.reason ? dim(` (${file.reason})`) : ''
          }`
        );
      });
    }
  }

  if (result.issues.length) {
    lines.push('', bold('Issues:'));
    result.issues.slice(0, options.verbose ? result.issues.length : 10).forEach((issue) => {
      const isError = issue.level === 'error';
      const levelColor = isError ? COLOR_RED : COLOR_YELLOW;
      lines.push(`${indent}${colorize(levelColor, `[${issue.level}]`)} ${issue.message}`);
    });
    if (!options.verbose && result.issues.length > 10) {
      lines.push(`${indent}${dim(`… ${result.issues.length - 10} more`)}`);
    }
  }

  return lines.join(NEWLINE);
};

export const writeTextReport = async (
  result: EvaluationResult,
  options: ConsoleReportOptions & { cwd?: string; outputPath?: string } = {}
): Promise<string> => {
  const cwd = options.cwd ?? result.context.cwd;
  const outputPath = options.outputPath ?? path.join(DEFAULT_REPORT_DIR, 'report.txt');
  const absolutePath = path.resolve(cwd, outputPath);
  const content = renderConsoleReport(result, { ...options, useColor: false });

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');

  return absolutePath;
};

export const writeMarkdownReport = async (
  result: EvaluationResult,
  options: { cwd?: string; outputPath?: string; includeConfig?: boolean; includeRelated?: boolean } = {}
): Promise<string> => {
  const cwd = options.cwd ?? result.context.cwd;
  const outputPath = options.outputPath ?? path.join(DEFAULT_REPORT_DIR, 'report.md');
  const absolutePath = path.resolve(cwd, outputPath);
  const content = renderMarkdownReport(result, options);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');

  return absolutePath;
};

const renderMarkdownReport = (
  result: EvaluationResult,
  options: { includeConfig?: boolean; includeRelated?: boolean } = {}
): string => {
  const { context } = result;
  const lines: string[] = [];

  lines.push('# Dev Analyzer Report');
  lines.push('');
  lines.push(`- **Framework**: ${context.framework || 'Unknown'}`);
  lines.push(`- **Score**: ${result.score}/100 (${result.level})`);
  lines.push(`- **Summary**: ${result.summary}`);
  lines.push('');

  if (context.metrics.buildEvents.length) {
    lines.push('## Build Metrics');
    lines.push('');
    lines.push(`- Total build events: ${context.metrics.buildEvents.length}`);
    const longest = Number(context.metrics.summary?.longestBuildMs ?? 0);
    if (longest) {
      lines.push(`- Longest build: ${longest} ms`);
    }
    lines.push('');
  }

  if (result.recommendations.length) {
    lines.push('## Recommendations');
    lines.push('');
    result.recommendations.forEach((rec) => {
      lines.push(`- **${rec.level.toUpperCase()}**: ${rec.message}`);
    });
    lines.push('');
  }

  if (result.llm?.summary) {
    lines.push('## LLM Insights');
    lines.push('');
    lines.push(result.llm.summary);
    lines.push('');
  }

  if (result.issues.length) {
    lines.push('## Issues');
    lines.push('');
    result.issues.forEach((issue) => {
      lines.push(`- [${issue.level.toUpperCase()}] ${issue.message}`);
    });
    lines.push('');
  }

  if (options.includeConfig && context.configFiles.length) {
    lines.push('## Config Files');
    lines.push('');
    context.configFiles.forEach((file) => {
      const status = file.exists ? '✅ Found' : '⚠️ Missing';
      const reason = file.reason ? ` (${file.reason})` : '';
      lines.push(`- ${status} \`${file.path}\`${reason}`);
    });
    lines.push('');
  }

  if (options.includeRelated && context.relatedFiles.length) {
    lines.push('## Related Files');
    lines.push('');
    context.relatedFiles.forEach((file) => {
      const status = file.exists ? '✅ Found' : '⚠️ Missing';
      const reason = file.reason ? ` (${file.reason})` : '';
      lines.push(`- ${status} \`${file.path}\`${reason}`);
    });
    lines.push('');
  }

  return lines.join(NEWLINE);
};

export const writeJsonReport = async (
  result: EvaluationResult,
  options: JsonReportOptions = {}
): Promise<string> => {
  const cwd = options.cwd ? path.resolve(options.cwd) : result.context.cwd;
  const outputPath = options.outputPath ?? path.join(DEFAULT_REPORT_DIR, DEFAULT_REPORT_FILENAME);
  const absolutePath = path.resolve(cwd, outputPath);
  const payload = buildJsonPayload(result, options);
  const indent = resolveIndent(options.pretty);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, JSON.stringify(payload, undefined, indent), 'utf8');

  return absolutePath;
};

const buildJsonPayload = (
  result: EvaluationResult,
  options: JsonReportOptions
): JsonReportPayload => {
  const { context } = result;
  const payload: JsonReportPayload = {
    generatedAt: new Date().toISOString(),
    score: result.score,
    level: result.level,
    summary: result.summary,
    recommendations: result.recommendations,
    issues: result.issues,
    framework: context.framework,
    metrics: context.metrics,
    prompt: {
      base: context.prompt.base,
      custom: context.prompt.custom,
    },
  };

  if (options.includeConfigFiles) {
    payload.configFiles = context.configFiles;
  }

  if (options.includeRelatedFiles) {
    payload.relatedFiles = context.relatedFiles;
  }

  if (options.includeRawLogs) {
    payload.rawLogs = context.transform.rawLogs;
  }

  if (result.llm?.summary) {
    payload.llm = {
      summary: result.llm.summary,
      provider: result.llm.provider,
      model: result.llm.model,
    };
  }

  return payload;
};

const resolveIndent = (pretty: JsonReportOptions['pretty']): number | undefined => {
  if (pretty === false) {
    return undefined;
  }

  if (typeof pretty === 'number') {
    return pretty;
  }

  return 2;
};

export * from './types';
