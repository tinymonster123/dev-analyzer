export const COLOR_RESET = '\u001b[0m';
export const COLOR_BOLD = '\u001b[1m';
export const COLOR_DIM = '\u001b[2m';
export const COLOR_GREEN = '\u001b[32m';
export const COLOR_YELLOW = '\u001b[33m';
export const COLOR_RED = '\u001b[31m';
export const COLOR_CYAN = '\u001b[36m';

export const DEFAULT_REPORT_FILENAME = 'dev-analyzer-report.json';
export const DEFAULT_REPORT_DIR = '.dev-analyzer';

export const LEVEL_COLOR_MAP: Record<string, string> = {
  Excellent: COLOR_GREEN,
  Good: COLOR_CYAN,
  Average: COLOR_YELLOW,
  Poor: COLOR_RED,
};

export const RECOMMENDATION_COLOR_MAP: Record<string, string> = {
  info: COLOR_CYAN,
  warning: COLOR_YELLOW,
  critical: COLOR_RED,
};
