import { assign, serialize, stringify } from 'src/utils/fp'
import { debounce } from 'lodash'
const net = require('react-native-tcp')
import { pipe, curry } from 'lodash/fp'

const LOG_LEVELS = {
  DEBUG: 1,
  LOG: 2,
  INFO: 3,
  WARN: 4,
  ERROR: 5
}

const client = net.createConnection(3001)

client.on('error', function(error) {
  skwaqr('tcp error:', error.message)
})

client.on('data', function(data) {
  skwaqr('skwaq-server sent message', data)
})
client.on('disconnect', _ => {
  skwaqr('tcp client disconnected')
})

const skwaqBrand = () => [
  '%c≪%cskwaq.bahx%c≫',
  'font-size: 16px; color: red; font-weight: bold',
  'font-size: 16px;color: white; font-weight: light; font-family: monospace;',
  'font-size: 16px;color: red; font-weight:bold'
]

const skwaqr = (...args) => console.debug(...skwaqBrand(), ...args)
const loggers = new Map()

const addLogger = logger => {
  loggers.set(logger.id, logger)
  client.write(
    `${JSON.stringify({
      cmd: 'add',
      data: {
        id: logger.id,
        parentPath: logger.parentPath,
        label: logger.label
      }
    })}\r\n`
  )
}

const _log = (id, level, reason, payload) => {
  if (client) {
    try {
      const o = {
        cmd: 'log',
        data: {
          loggerID: id,
          reason,
          level,
          payload
        }
      }
      const out = `${serialize(o)}\r\n`
      client.write(out)
    } catch (e) {
      skwaqr('ERROR WRITING TO SOCKET:', e.message)
    }
  }

  //
  // //addEvent(evt)
  // if(logger.enabled) {
  //   switch(level) {
  //     case LOG_LEVELS.ERROR:
  //       console.log('[',logger.label, ' ERROR]', ...args)
  //       break
  //     default:
  //       console.log('[',logger.label,']', ...args)
  //       break
  //   }
  //
  // }
}

const defaults = () => ({
  parentPath: [],
  id: loggers.size,
  enabled: true
})

export const createLogger = (label, opts = {}) => {
  const { LOG, WARN, INFO, ERROR, DEBUG, REMOTE } = LOG_LEVELS
  const logger = {
    label,
    log(...args) {
      _log(logger.id, LOG, ...args)
      return args[args.length - 1]
    },
    warn(...args) {
      _log(logger.id, WARN, ...args)
      return args[args.length - 1]
    },
    nfo(...args) {
      _log(logger.id, INFO, ...args)
      return args[args.length - 1]
    },
    err(...args) {
      _log(logger.id, ERROR, ...args)
      return args[args.length - 1]
    },
    dbg(...args) {
      _log(logger.id, DEBUG, ...args)
      return args[args.length - 1]
    },
    rem: debounce(
      (...args) => {
        _log(logger.id, REMOTE, ...args)
        return args[args.length - 1]
      },
      500,
      { leading: true, maxWait: 250 }
    ),
    createSpy: curry((lbl, l, o) => {
      logger.log(l, '𝝺', o)
      return o
    }),
    createChild(lbl) {
      const lgr = createLogger(lbl, {
        parentPath: logger.parentPath.concat([logger.id])
      })
      return lgr
    },
    ...defaults(),
    ...opts
  }
  addLogger(logger)
  return logger
}

global.skwaq = {
  createLogger,
  skwaqr
}
