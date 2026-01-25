import pino from 'pino';
import type { Request, Response, NextFunction } from 'express';

// Create pretty logger for development
export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false,
      messageFormat: '{msg}',
    }
  },
  level: process.env.LOG_LEVEL || 'info',
});

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, url, body, query, params } = req;
  
  // Log incoming request
  logger.info({
    type: 'request',
    method,
    url,
    query: query && Object.keys(query).length > 0 ? query : undefined,
    params: params && Object.keys(params).length > 0 ? params : undefined,
    body: method !== 'GET' && body && Object.keys(body).length > 0 ? sanitizeBody(body) : undefined,
  }, `📥 ${method} ${url}`);

  // Log response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    
    logger[level]({
      type: 'response',
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
    }, `📤 ${method} ${url} ${statusCode} - ${duration}ms`);
    
    return originalSend.call(this, data);
  };

  next();
}

// Sanitize sensitive data from body
function sanitizeBody(body: any): any {
  if (!body) return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

// Error logging middleware
export function errorLogger(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error({
    type: 'error',
    method: req.method,
    url: req.url,
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    }
  }, `❌ Error: ${err.message}`);
  
  next(err);
}

// Database operation logger
export function logDbOperation(operation: string, table: string, details?: any) {
  logger.debug({
    type: 'database',
    operation,
    table,
    details,
  }, `🗄️  DB ${operation}: ${table}`);
}

// Auth operation logger
export function logAuthOperation(action: string, userId?: string, details?: any) {
  logger.info({
    type: 'auth',
    action,
    userId,
    details,
  }, `🔐 Auth: ${action}${userId ? ` (user: ${userId})` : ''}`);
}

// Business logic logger
export function logBusinessOperation(operation: string, details?: any) {
  logger.info({
    type: 'business',
    operation,
    details,
  }, `⚙️  ${operation}`);
}

export default logger;
