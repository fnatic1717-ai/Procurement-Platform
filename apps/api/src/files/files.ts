import { Injectable } from '@nestjs/common';
import type {
  AuthenticatedPrincipal,
  FileClassification,
  FileScanStatus,
  FileUploadState,
} from '@procurement/shared';
import { PolicyService } from '../authorization/policy.js';

export interface FileMetadata {
  id: string;
  tenantId: string;
  uploadState: FileUploadState;
  scanStatus: FileScanStatus;
  classification: FileClassification;
  storageKey: string;
  uploaderId: string;
  linkedObjectType: string;
  linkedObjectId: string;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}
export interface ObjectStorageUrlProvider {
  createAuthorizedUploadUrl(file: FileMetadata): Promise<SignedUrlResult>;
  createAuthorizedDownloadUrl(file: FileMetadata): Promise<SignedUrlResult>;
}

@Injectable()
export class FileAuthorizationService {
  constructor(private readonly policies: PolicyService) {}

  canRead(
    principal: AuthenticatedPrincipal | null,
    file: FileMetadata,
    objectScope: { type: string; id: string },
  ): boolean {
    if (file.linkedObjectType !== objectScope.type || file.linkedObjectId !== objectScope.id)
      return false;
    if (file.uploadState !== 'clean' || file.scanStatus !== 'clean') return false;
    const permission =
      file.classification === 'restricted' ? 'files.restricted.read' : 'files.read';
    return this.policies.can(principal, {
      tenantId: file.tenantId,
      permission,
      objectScope: `${objectScope.type}:${objectScope.id}`,
    });
  }

  canCreateUpload(principal: AuthenticatedPrincipal | null, tenantId: string): boolean {
    return this.policies.can(principal, { tenantId, permission: 'files.write' });
  }
}
