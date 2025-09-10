'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.createLogger = createLogger;
exports.httpLogger = httpLogger;
const pino_1 = __importDefault(require('pino'));
const pino_http_1 = __importDefault(require('pino-http'));
function createLogger(options) {
  return (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    ...options,
  });
}
function httpLogger() {
  return (0, pino_http_1.default)({
    customProps: (_req, res) => ({ tenant_id: res.locals?.tenant_id }),
  });
}
