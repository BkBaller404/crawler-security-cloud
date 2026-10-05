import { inject, Injectable } from '@angular/core';
import { SailpointPluginService } from './sailpoint-plugin.service';

export interface DungeonIdentity {
  id: string;
  name: string;
  department: string;
  accessCount: number | null;
  roleCount: number | null;
  score: number | null;
  mood: 'NAUGHTY' | 'SUSPICIOUS' | 'BORING' | 'UNKNOWN';
}

export interface DungeonCampaign {
  id?: string | null;
  name: string;
  status?: string | null;
}

export interface AccessReference {
  id: string;
  name: string;
}

export interface IdentityInvestigation {
  details: { name?: string; emailAddress?: string | null; identityStatus?: string; attributes?: Record<string, unknown> } | null;
  roles: AccessReference[] | null;
  entitlements: AccessReference[] | null;
  errors: string[];
}

export function apiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'ISC could not complete this request. Check your plugin scopes and user permissions.';
}

function references(value: unknown, nestedKey: string): AccessReference[] {
  if (!Array.isArray(value)) throw new Error('ISC returned an unexpected access response.');
  return value.map((item: Record<string, unknown>) => {
    const reference = (item[nestedKey] ?? item) as Record<string, unknown>;
    if (typeof reference['id'] !== 'string') throw new Error('ISC returned an access item without an ID.');
    return { id: reference['id'], name: typeof reference['name'] === 'string' ? reference['name'] : reference['id'] };
  });
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function toDungeonIdentity(value: unknown): DungeonIdentity {
  if (!value || typeof value !== 'object') throw new Error('Search returned an invalid identity.');
  const identity = value as Record<string, unknown>;
  if (typeof identity['id'] !== 'string' || !identity['id']) throw new Error('Search identity has no ID.');
  const attributes = identity['attributes'] as Record<string, unknown> | undefined;
  const accessCount = count(identity['accessCount']);
  const roleCount = count(identity['roleCount']);
  const score = accessCount === null || roleCount === null ? null : accessCount * 2 + roleCount * 5;
  return {
    id: identity['id'],
    name: typeof identity['displayName'] === 'string' ? identity['displayName'] : typeof identity['name'] === 'string' ? identity['name'] : identity['id'],
    department: typeof attributes?.['department'] === 'string' ? attributes['department'] : 'Not provided',
    accessCount, roleCount, score,
    mood: accessCount === null ? 'UNKNOWN' : accessCount > 30 ? 'NAUGHTY' : accessCount > 15 ? 'SUSPICIOUS' : 'BORING',
  };
}

@Injectable({ providedIn: 'root' })
export class DungeonService {
  private readonly plugin = inject(SailpointPluginService);

  async searchIdentities(): Promise<DungeonIdentity[]> {
    if (!this.plugin.apiReady()) throw new Error('Open this plugin inside ISC to load real identities.');
    const results = await this.plugin.post<unknown>('/search/v1?limit=25', {
      indices: ['identities'], query: { query: '*' }, sort: ['displayName', 'id'],
    });
    if (!Array.isArray(results)) throw new Error('Search returned an unexpected response.');
    return results.map(toDungeonIdentity);
  }

  async listIdentities(): Promise<DungeonIdentity[]> {
    if (!this.plugin.apiReady()) throw new Error('Open this plugin inside ISC to load real identities.');
    const results = await this.plugin.get<unknown>('/identities/v1?limit=25&offset=0&sorters=name&defaultFilter=NONE');
    if (!Array.isArray(results)) throw new Error('Identities returned an unexpected response.');
    return results.map(toDungeonIdentity);
  }

  async investigate(identityId: string): Promise<IdentityInvestigation> {
    if (!this.plugin.apiReady()) throw new Error('ISC connection is required to investigate identities.');
    const id = encodeURIComponent(identityId);
    const results = await Promise.allSettled([
      this.plugin.get<IdentityInvestigation['details']>(`/identities/v1/${id}`),
      this.plugin.get<unknown>(`/identities/v1/${id}/role-assignments`).then(value => references(value, 'role')),
      this.plugin.get<unknown>(`/entitlements/v1/identities/${id}/entitlements?limit=50&offset=0`).then(value => references(value, 'objectRef')),
    ]);
    const [details, roles, entitlements] = results;
    const labels = ['Identity details', 'Role assignments', 'Entitlements'];
    return {
      details: details.status === 'fulfilled' ? details.value : null,
      roles: roles.status === 'fulfilled' ? roles.value : null,
      entitlements: entitlements.status === 'fulfilled' ? entitlements.value : null,
      errors: results.flatMap((result, index) => result.status === 'rejected' ? [`${labels[index]}: ${apiError(result.reason)}`] : []),
    };
  }

  async createJudgment(identity: DungeonIdentity, reviewerId: string): Promise<DungeonCampaign> {
    if (!this.plugin.apiReady()) throw new Error('ISC connection is required to create a campaign.');
    if (!identity.id || !reviewerId.trim()) throw new Error('An identity and reviewer are required.');
    return this.plugin.post<DungeonCampaign>('/campaigns/v1', {
      name: `Dungeon Judgment - ${identity.name}`,
      description: 'The Dungeon AI demands judgment. Selected identity access review.',
      type: 'SEARCH',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      emailNotificationEnabled: false,
      autoRevokeAllowed: false,
      recommendationsEnabled: false,
      searchCampaignInfo: {
        type: 'IDENTITY', identityIds: [identity.id],
        reviewer: { type: 'IDENTITY', id: reviewerId.trim() },
      },
    });
  }
}