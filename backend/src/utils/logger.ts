export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlation_id?: string;
  message: string;
  [key: string]: any;
}

export const logger = {
  log(level: LogLevel, message: string, meta: { correlation_id?: string; [key: string]: any } = {}) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    
    const output = JSON.stringify(entry);

    if (level === LogLevel.ERROR) {
      console.error(output);
    } else if (level === LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  },

  info(message: string, meta: { correlation_id?: string; [key: string]: any } = {}) {
    this.log(LogLevel.INFO, message, meta);
  },

  warn(message: string, meta: { correlation_id?: string; [key: string]: any } = {}) {
    this.log(LogLevel.WARN, message, meta);
  },

  error(message: string, meta: { correlation_id?: string; [key: string]: any } = {}) {
    this.log(LogLevel.ERROR, message, meta);
  },
};
