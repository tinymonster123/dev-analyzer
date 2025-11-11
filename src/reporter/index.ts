import { promises as fs } from 'fs';
import path from 'path';
import { EvaluationResult } from '../evaluator/types';
import { TextReportOptions, JsonReportOptions, JsonReportPayload } from './types';
import { DEFAULT_REPORT_DIR, DEFAULT_REPORT_FILENAME } from './constants';

const NEWLINE = '\n';

const renderTextReport = (
  result: EvaluationResult,
  options: TextReportOptions = {}
): string => {
  const { context } = result;
  const indent = '  ';
  const lines: string[] = [];

  lines.push('Dev Analyzer Report');
  lines.push('===================');
  lines.push('');
  lines.push(`Framework: ${context.framework || 'Unknown'}`);
  lines.push(`Score: ${result.score}/100 (${result.level})`);
  lines.push(`Summary: ${result.summary}`);
  lines.push('');

  if (context.metrics.buildEvents.length) {
    const longest = Number(context.metrics.summary?.longestBuildMs ?? 0);
    lines.push('Build Metrics:');
    lines.push(`${indent}Events: ${context.metrics.buildEvents.length}`);
    if (longest) {
      lines.push(`${indent}Longest build: ${longest} ms`);
    }
    lines.push('');
  }

  if (result.recommendations.length) {
    lines.push('Recommendations:');
    result.recommendations.forEach((rec) => {
      lines.push(`${indent}[${rec.level.toUpperCase()}] ${rec.message}`);
    });
    lines.push('');
  }

  if (result.llm?.summary) {
    lines.push('LLM Insights:');
    result.llm.summary.split(/\r?\n/).forEach((line) => {
      lines.push(`${indent}${line}`);
    });
    lines.push('');
  }

  if (result.issues.length) {
    lines.push('Issues:');
    const limit = options.verbose ? result.issues.length : Math.min(10, result.issues.length);
    result.issues.slice(0, limit).forEach((issue) => {
      lines.push(`${indent}[${issue.level}] ${issue.message}`);
    });
    if (!options.verbose && result.issues.length > limit) {
      lines.push(`${indent}… ${result.issues.length - limit} more`);
    }
    lines.push('');
  }

  if (options.verbose) {
    if (context.configFiles.length) {
      lines.push('Config Files:');
      context.configFiles.forEach((file) => {
        const status = file.exists ? 'found' : 'missing';
        const reason = file.reason ? ` (${file.reason})` : '';
        lines.push(`${indent}${status.padEnd(8)} ${file.path}${reason}`);
      });
      lines.push('');
    }

    if (context.relatedFiles.length) {
      lines.push('Related Files:');
      context.relatedFiles.forEach((file) => {
        const status = file.exists ? 'found' : 'missing';
        const reason = file.reason ? ` (${file.reason})` : '';
        lines.push(`${indent}${status.padEnd(8)} ${file.path}${reason}`);
      });
      lines.push('');
    }
  }

  return lines.join(NEWLINE);
};

export const writeTextReport = async (
  result: EvaluationResult,
  options: TextReportOptions & { cwd?: string; outputPath?: string } = {}
): Promise<string> => {
  const cwd = options.cwd ?? result.context.cwd;
  const outputPath = options.outputPath ?? path.join(DEFAULT_REPORT_DIR, 'report.txt');
  const absolutePath = path.resolve(cwd, outputPath);
  const content = renderTextReport(result, options);

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
