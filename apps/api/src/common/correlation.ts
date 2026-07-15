import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SAFE_CORRELATION_ID = /^[a-zA-Z0-9._:-]{1,96}$/;

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const provided = req.header('x-correlation-id');
  const id = provided && SAFE_CORRELATION_ID.test(provided) ? provided : randomUUID();
  req.correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
}
