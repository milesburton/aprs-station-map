import pino from 'pino'

const isBrowser = typeof window !== 'undefined'
const isDev = isBrowser && import.meta.env?.DEV

const browserConfig = {
  browser: {
    asObject: true,
    write: {
      debug: (o: object) => console.debug(JSON.stringify(o)),
      info: (o: object) => console.info(JSON.stringify(o)),
      warn: (o: object) => console.warn(JSON.stringify(o)),
      error: (o: object) => console.error(JSON.stringify(o)),
    },
  },
}

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isBrowser ? browserConfig : {}),
})

export const createChildLogger = (name: string) => logger.child({ module: name })
