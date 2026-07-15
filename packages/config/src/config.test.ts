import { describe, expect, it } from 'vitest';
import { loadConfig } from './index.js';
describe('configuration validation',()=>{ it('rejects development auth in production',()=>{ expect(()=>loadConfig({NODE_ENV:'production',DATABASE_URL:'postgresql://u:p@localhost:5432/db',REDIS_URL:'redis://localhost:6379',AUTH_ADAPTER:'development'})).toThrow(); }); it('accepts local test config',()=>{ expect(loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://u:p@localhost:5432/db',REDIS_URL:'redis://localhost:6379'}).AUTH_ADAPTER).toBe('development'); }); });
