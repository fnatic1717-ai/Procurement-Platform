import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditService } from './audit/audit.js';
import { authProviderFactory, PrincipalLoader } from './auth/auth.js';
import { AuthenticationGuard } from './auth/auth.guard.js';
import { AuthorizationGuard } from './authorization/authorization.guard.js';
import { PolicyService } from './authorization/policy.js';
import { FileAuthorizationService } from './files/files.js';
import { HealthController } from './health/health.js';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  controllers: [HealthController],
  providers: [
    AuditService,
    PolicyService,
    PrincipalLoader,
    authProviderFactory,
    FileAuthorizationService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule {}
