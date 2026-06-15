type Level = 'info' | 'warning' | 'error' | 'critical'

const PREFIX: Record<Level, string> = {
  info:     '[INFO]    ',
  warning:  '[WARNING] ',
  error:    '[ERROR]   ',
  critical: '[CRITICAL]',
}

function log(level: Level, module: string, message: string, data?: unknown): void {
  const ts = new Date().toISOString()
  const line = `${ts} ${PREFIX[level]} [${module}] ${message}`
  if (data !== undefined) {
    // eslint-disable-next-line no-console
    console.log(line, typeof data === 'string' ? data : JSON.stringify(data))
  } else {
    // eslint-disable-next-line no-console
    console.log(line)
  }
}

export const logger = {
  info:     (module: string, msg: string, data?: unknown) => log('info',     module, msg, data),
  warning:  (module: string, msg: string, data?: unknown) => log('warning',  module, msg, data),
  error:    (module: string, msg: string, data?: unknown) => log('error',    module, msg, data),
  critical: (module: string, msg: string, data?: unknown) => log('critical', module, msg, data),
}
