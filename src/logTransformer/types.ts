import { LogEntry } from '../logCollector/types';

export interface TransformLogsOptions {
  framework: string;
  logs: LogEntry[];
}

export interface Issue {
  level: 'error' | 'warning' | 'info';
  message: string;
  details?: Record<string, unknown>;
  occurrences?: number;
}

export type BuildEventType = 'initial' | 'incremental';

export interface BuildEvent {
  target: string;
  durationMs: number | null;
  modules?: number | null;
  type: BuildEventType;
}

export interface LogMetrics {
  buildEvents: BuildEvent[];
  warnings: Issue[];
  errors: Issue[];
  notes: Issue[];
  summary?: Record<string, unknown>;
}

export interface LogTransformResult {
  framework: string;
  metrics: LogMetrics;
  rawLogs: LogEntry[];
}

export interface LogParser {
  canHandle: (framework: string) => boolean;
  parse: (options: TransformLogsOptions) => LogTransformResult;
}
