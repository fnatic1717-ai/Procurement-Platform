import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health/health.js';
import { PolicyService } from './authorization/policy.js';
import { AuditService } from './audit/audit.js';
import { DevelopmentAuthProvider } from './auth/auth.js';
import { FileAuthorizationService } from './files/files.js';
@Module({ imports:[ThrottlerModule.forRoot([{ttl:60000,limit:120}])], controllers:[HealthController], providers:[PolicyService,AuditService,DevelopmentAuthProvider,FileAuthorizationService] })
export class AppModule {}
