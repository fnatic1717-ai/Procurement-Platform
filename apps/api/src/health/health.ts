import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { prisma } from '@procurement/database';
import Redis from 'ioredis';
import { Public } from '../decorators/public.js';

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Dependency timeout')), milliseconds)),
  ]);
}

@Public()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  health() {
    return { status: 'healthy', dependency: 'application' };
  }

  @Get('database')
  async database() {
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, 1_000);
      return { status: 'healthy', dependency: 'postgresql' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', dependency: 'postgresql' });
    }
  }

  @Get('redis')
  async redis() {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 0 });
    try {
      await withTimeout(redis.connect(), 1_000);
      const pong = await withTimeout(redis.ping(), 1_000);
      if (pong !== 'PONG') throw new Error('Unexpected Redis response');
      return { status: 'healthy', dependency: 'redis' };
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', dependency: 'redis' });
    } finally {
      redis.disconnect();
    }
  }
}
