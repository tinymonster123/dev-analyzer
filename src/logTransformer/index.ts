import { LogEntry } from '../logCollector/types';
import { nextLogParser } from './parsers/next';
import {
  TransformLogsOptions,
  LogTransformResult,
  LogParser,
  LogMetrics,
  BuildEvent,
} from './types';

const PARSERS: LogParser[] = [nextLogParser];

/**
 * 将原始日志转换为结构化指标，便于 evaluator 使用。
 */
export const transformLogs = (options: TransformLogsOptions): LogTransformResult => {
  const parser = PARSERS.find((candidate) => candidate.canHandle(options.framework));
  if (parser) {
    return parser.parse(options);
  }

  return defaultTransform(options);
};

/**
 * 提供一个保底解析器，原样返回日志但给出空指标。
 */
const defaultTransform = ({ framework, logs }: TransformLogsOptions): LogTransformResult => ({
  framework,
  metrics: emptyMetrics(),
  rawLogs: logs,
});

const emptyMetrics = (): LogMetrics => ({
  buildEvents: [],
  warnings: [],
  errors: [],
  notes: [],
  summary: {},
});

/**
 * 工具方法：合并多组构建事件。
 */
export const mergeBuildEvents = (...groups: BuildEvent[][]): BuildEvent[] => {
  return groups.flat().sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));
};

/**
 * 工具方法：过滤日志文本。
 */
export const filterLogs = (logs: LogEntry[], predicate: (entry: LogEntry) => boolean): LogEntry[] => {
  return logs.filter(predicate);
};

export * from './types';
