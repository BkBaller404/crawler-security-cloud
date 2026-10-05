import { TestBed } from '@angular/core/testing';
import { DungeonService, toDungeonIdentity } from './dungeon.service';
import { SailpointPluginService } from './sailpoint-plugin.service';

describe('Dungeon ISC integration', () => {
  const post = vi.fn();
  const get = vi.fn();
  const apiReady = vi.fn();
  let service: DungeonService;
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    apiReady.mockReturnValue(true);
    TestBed.configureTestingModule({ providers: [{ provide: SailpointPluginService, useValue: { post, get, apiReady } }] });
    service = TestBed.inject(DungeonService);
  });

  it('searches a bounded identity page through the plugin SDK', async () => {
    post.mockResolvedValue([{ id: 'real-id', displayName: 'Jane', attributes: { department: 'Finance' }, accessCount: 47, roleCount: 8 }]);
    const results = await service.searchIdentities();
    expect(post).toHaveBeenCalledWith('/search/v1?limit=25', { indices: ['identities'], query: { query: '*' }, sort: ['displayName', 'id'] });
    expect(results[0]).toMatchObject({ name: 'Jane', department: 'Finance', score: 134, mood: 'NAUGHTY' });
  });

  it('does not fabricate missing counts', () => {
    expect(toDungeonIdentity({ id: 'id' })).toMatchObject({ accessCount: null, roleCount: null, score: null, mood: 'UNKNOWN' });
    expect(toDungeonIdentity({ id: 'id', accessCount: 0, roleCount: 0 })).toMatchObject({ score: 0, mood: 'BORING' });
    expect(toDungeonIdentity({ id: 'id', accessCount: 16 })).toMatchObject({ mood: 'SUSPICIOUS', score: null });
    expect(toDungeonIdentity({ id: 'id', accessCount: -1 })).toMatchObject({ accessCount: null });
  });

  it('never calls ISC when standalone', async () => {
    apiReady.mockReturnValue(false);
    await expect(service.searchIdentities()).rejects.toThrow('inside ISC');
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects malformed search responses', async () => {
    post.mockResolvedValue({ items: [] });
    await expect(service.searchIdentities()).rejects.toThrow('unexpected response');
  });

  it('lists real identities without inventing search counts', async () => {
    get.mockResolvedValue([{ id: 'id', name: 'Walter', attributes: { department: 'Chemistry' } }]);
    expect((await service.listIdentities())[0]).toMatchObject({ name: 'Walter', score: null, mood: 'UNKNOWN' });
    expect(get).toHaveBeenCalledWith('/identities/v1?limit=25&offset=0&sorters=name&defaultFilter=NONE');
  });

  it('retrieves details and normalizes both entitlement response forms', async () => {
    get.mockResolvedValueOnce({ name: 'Walter' }).mockResolvedValueOnce([{ id: 'assignment', role: { id: 'role', name: 'Engineer' } }]).mockResolvedValueOnce([{ objectRef: { id: 'entitlement', name: 'VPN' } }, { id: 'flat', name: 'Slack' }]);
    const result = await service.investigate('identity/id');
    expect(get).toHaveBeenCalledWith('/identities/v1/identity%2Fid');
    expect(get).toHaveBeenCalledWith('/identities/v1/identity%2Fid/role-assignments');
    expect(get).toHaveBeenCalledWith('/entitlements/v1/identities/identity%2Fid/entitlements?limit=50&offset=0');
    expect(result.roles).toEqual([{ id: 'role', name: 'Engineer' }]);
    expect(result.entitlements).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it('preserves partial investigation data when entitlement permissions fail', async () => {
    get.mockResolvedValueOnce({ name: 'Walter' }).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Forbidden'));
    const result = await service.investigate('id');
    expect(result.details?.name).toBe('Walter');
    expect(result.roles).toEqual([]);
    expect(result.entitlements).toBeNull();
    expect(result.errors).toEqual(['Entitlements: Forbidden']);
  });

  it('creates only a single-identity campaign without activation or access constraints', async () => {
    post.mockResolvedValue({ id: 'campaign', name: 'Dungeon Judgment - Jane', status: 'PENDING' });
    await service.createJudgment(toDungeonIdentity({ id: 'target', displayName: 'Jane' }), ' reviewer ');
    const [path, payload] = post.mock.calls[0];
    expect(path).toBe('/campaigns/v1');
    expect(payload).toMatchObject({ type: 'SEARCH', emailNotificationEnabled: false, autoRevokeAllowed: false, searchCampaignInfo: { type: 'IDENTITY', identityIds: ['target'], reviewer: { type: 'IDENTITY', id: 'reviewer' } } });
    expect(payload.searchCampaignInfo.accessConstraints).toBeUndefined();
    expect(new Date(payload.deadline).getTime()).toBeGreaterThan(Date.now());
    expect(post).toHaveBeenCalledTimes(1);
  });
});