import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) { const id = req.header('x-correlation-id') ?? randomUUID(); res.setHeader('x-correlation-id', id); next(); }
