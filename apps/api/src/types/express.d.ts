import type { AuthenticatedPrincipal } from '@procurement/shared';
declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
      correlationId?: string;
    }
  }
}
export {};
