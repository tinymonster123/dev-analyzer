import { DetectManagerResult, PackageManager } from '../detectManager/types';

export interface LogCollectorOptions {
  cwd?: string;
  managerResult?: DetectManagerResult;
  command?: string;
  args?: string[];
  onLog?: (entry: LogEntry) => void;
}

export interface LogEntry {
  type: 'stdout' | 'stderr';
  message: string;
  timestamp: number;
}

export interface DevCommandResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  logs: LogEntry[];
}

export interface ResolveCommandOptions {
  manager: PackageManager;
  fallbackCommand?: string;
  fallbackArgs?: string[];
}

export interface CommandConfig {
  command: string;
  args: string[];
}
