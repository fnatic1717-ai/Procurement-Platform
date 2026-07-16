import { SetMetadata } from '@nestjs/common';
import { REQUIRED_PERMISSIONS } from '../auth/auth.js';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);
