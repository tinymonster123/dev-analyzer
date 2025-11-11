import { TransformLogsOptions, LogTransformResult, Issue, BuildEvent } from '../types';
import { LogEntry } from '../../logCollector/types';

const SECONDS_REGEX = /([\d.]+)\s*s/;
const MILLIS_REGEX = /([\d.]+)\s*ms/;
const MODULES_REGEX = /(\d+)\s*modules/;

const WAIT_PREFIX = '- wait';
const EVENT_PREFIX = '- event';

export const nextLogParser = {
  canHandle: (framework: string): boolean => framework.toLowerCase().includes('next'),

  parse: ({ framework, logs }: TransformLogsOptions): LogTransformResult => {
    const warnings: Issue[] = [];
    const errors: Issue[] = [];
    const notes: Issue[] = [];
    const buildEvents: BuildEvent[] = [];

    let lastWaitContext: string | null = null;

    for (const entry of logs) {
      const line = entry.message.trim();

      if (!line) {
        continue;
      }

      if (isWaitLine(line)) {
        lastWaitContext = normalizeWaitTarget(line);
        continue;
      }

      if (isEventCompiledLine(line)) {
        const event = parseBuildEvent(line, lastWaitContext);
        buildEvents.push(event);
        lastWaitContext = null;
        continue;
      }

      if (line.startsWith('Duplicate page detected')) {
        errors.push({
          level: 'error',
          message: line,
        });
        continue;
      }

      if (line.startsWith('The page component is named "layout"')) {
        const detail = collectIndentedBlock(logs, entry);
        errors.push({
          level: 'error',
          message: line,
          details: { routes: detail },
        });
        continue;
      }

      if (line.includes('was successfully patched')) {
        notes.push({ level: 'info', message: line });
        continue;
      }

      if (line.startsWith('- warn') || line.startsWith('warn -')) {
        warnings.push({ level: 'warning', message: line });
        continue;
      }

      if (line.includes('DeprecationWarning')) {
        warnings.push({ level: 'warning', message: line });
      }
    }

    return {
      framework,
      metrics: {
        buildEvents,
        warnings,
        errors,
        notes,
        summary: summarize(buildEvents),
      },
      rawLogs: logs,
    };
  },
};

const isWaitLine = (line: string): boolean => {
  return line.startsWith(WAIT_PREFIX);
};

const normalizeWaitTarget = (line: string): string => {
  const withoutPrefix = line.slice(WAIT_PREFIX.length).trim();
  const withoutEllipsis = withoutPrefix.replace(/\.\.\.$/, '').trim();

  const compilingMatch = withoutEllipsis.match(/compiling\s+(.+)/i);
  if (compilingMatch) {
    return compilingMatch[1].replace(/\(.*\)/, '').trim() || 'build';
  }

  return withoutEllipsis || 'build';
};

const isEventCompiledLine = (line: string): boolean => {
  return line.startsWith(`${EVENT_PREFIX} compiled`);
};

const parseBuildEvent = (line: string, context: string | null): BuildEvent => {
  const duration = parseDuration(line);
  const modules = parseModules(line);
  const target = context ?? inferTarget(line);
  return {
    target,
    durationMs: duration,
    modules,
    type: inferBuildType(line, context),
  };
};

const parseDuration = (line: string): number | null => {
  const secondsMatch = line.match(SECONDS_REGEX);
  if (secondsMatch) {
    return parseFloat(secondsMatch[1]) * 1000;
  }

  const millisMatch = line.match(MILLIS_REGEX);
  if (millisMatch) {
    return parseFloat(millisMatch[1]);
  }

  return null;
};

const parseModules = (line: string): number | null => {
  const modulesMatch = line.match(MODULES_REGEX);
  return modulesMatch ? Number(modulesMatch[1]) : null;
};

const inferTarget = (line: string): string => {
  const targetMatch = line.match(/compiled\s+(.*)\s+successfully/i);
  if (targetMatch) {
    return targetMatch[1].replace(/client and server/i, '').trim() || 'build';
  }
  return 'build';
};

const inferBuildType = (line: string, context: string | null): BuildEvent['type'] => {
  if (context) {
    return 'incremental';
  }
  return line.includes('client and server') ? 'initial' : 'incremental';
};

const collectIndentedBlock = (logs: LogEntry[], startEntry: LogEntry): string[] => {
  const result: string[] = [];
  let startRecording = false;

  for (const entry of logs) {
    if (entry === startEntry) {
      startRecording = true;
      continue;
    }

    if (!startRecording) continue;

    if (!entry.message.startsWith('        ')) {
      break;
    }

    result.push(entry.message.trim());
  }

  return result;
};

const summarize = (buildEvents: BuildEvent[]): Record<string, unknown> => {
  if (!buildEvents.length) {
    return {};
  }

  const longest = buildEvents.reduce((acc, cur) => {
    if (!acc.durationMs) return cur;
    if (!cur.durationMs) return acc;
    return cur.durationMs > acc.durationMs ? cur : acc;
  });

  return {
    eventCount: buildEvents.length,
    longestBuildMs: longest.durationMs ?? null,
    longestTarget: longest.target ?? null,
  };
};
