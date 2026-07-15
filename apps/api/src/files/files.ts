import { Injectable } from '@nestjs/common';
import type { AuthenticatedPrincipal, FileUploadState } from '@procurement/shared';
import { PolicyService } from '../authorization/policy.js';
export interface FileMetadata { id: string; tenantId: string; uploadState: FileUploadState; classification: 'internal'|'supplier_visible'|'restricted'; storageKey: string; }
export interface SignedUrlProvider { createDownloadUrl(file: FileMetadata): Promise<{ url: string; expiresAt: Date }>; }
@Injectable()
export class FileAuthorizationService { constructor(private readonly policies: PolicyService) {} canRead(principal: AuthenticatedPrincipal | null, file: FileMetadata): boolean { if (!this.policies.can(principal,{tenantId:file.tenantId,permission:'files.read'})) return false; return file.uploadState === 'clean' && file.classification !== 'restricted'; } }
