import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    AUTH0_DOMAIN: z.string().optional(),
    AUTH0_AUDIENCE: z.string().optional(),
    AUTH_ADAPTER: z.enum(['auth0', 'development']).default('development'),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.AUTH_ADAPTER === 'development') {
      context.addIssue({
        code: 'custom',
        message: 'Development authentication adapter is forbidden in production',
        path: ['AUTH_ADAPTER'],
      });
    }
    if (value.AUTH_ADAPTER === 'auth0' && (!value.AUTH0_DOMAIN || !value.AUTH0_AUDIENCE)) {
      context.addIssue({
        code: 'custom',
        message: 'Auth0 domain and audience are required when AUTH_ADAPTER=auth0',
        path: ['AUTH0_DOMAIN'],
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
