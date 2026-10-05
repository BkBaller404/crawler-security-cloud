import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { SailpointPluginService } from '@core';

describe('Crawler access catalog', () => {
  let fixture: ComponentFixture<App>;
  let element: HTMLElement;
  const context = signal<{ user: { displayName: string } } | null>({ user: { displayName: 'Test Crawler' } });
  const post = vi.fn();
  const get = vi.fn();
  const apiReady = vi.fn(() => true);

  beforeEach(async () => {
    context.set({ user: { displayName: 'Test Crawler' } });
    post.mockReset();
    get.mockReset();
    apiReady.mockReturnValue(true);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: SailpointPluginService, useValue: { context, status: signal('ready'), post, get, apiReady } }],
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    element = fixture.nativeElement;
    fixture.detectChanges();
    click('input[type="checkbox"]');
    click('.room-actions .primary-button');
  });

  function click(selector: string): void {
    const button = element.querySelector<HTMLButtonElement>(selector);
    expect(button).not.toBeNull();
    button!.click();
    fixture.detectChanges();
  }

  it('renders four loot choices and the SDK identity', () => {
    expect(element.querySelectorAll('.loot-card')).toHaveLength(4);
    expect(element.textContent).toContain('Test Crawler');
    expect(element.textContent).toContain('ISC LINK ESTABLISHED');
    expect(element.textContent).toContain('NO REAL ACCESS IS PROVISIONED');
  });

  it('falls back to JDoe without host context', () => {
    context.set(null);
    fixture.detectChanges();
    expect(element.querySelector('.hud')?.textContent).toContain('JDoe');
  });

  it('grants common loot without API calls and prevents duplicate counts', () => {
    click('[aria-label="Request GitHub Developer"]');
    expect(element.querySelector('.success')?.textContent).toContain('A perfectly reasonable request. Boring.');
    click('.primary-button');
    click('[aria-label="Request GitHub Developer"]');
    expect(element.querySelector('.hud-loot')?.textContent).toContain('01');
    expect(post).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('grants rare loot with its own verdict', () => {
    click('[aria-label="Request Production Database"]');
    expect(element.querySelector('.success')?.textContent).toContain('Interesting.');
  });

  it('keeps the AI concerned after an epic request', () => {
    click('[aria-label="Request AWS Developer"]');
    expect(element.querySelector('.success')?.textContent).toContain('The AI is becoming concerned.');
    click('.primary-button');
    expect(element.querySelector('.mood')?.textContent).toContain('concerned');
    expect(element.querySelector('.ai-note')?.textContent).toContain('becoming concerned');
  });

  it('runs the full demo sequence and never grants Domain Admin', () => {
    click('[aria-label="Request GitHub Developer"]');
    click('.primary-button');
    click('[aria-label="Request AWS Developer"]');
    click('.primary-button');
    click('[aria-label="Request Domain Admin"]');
    expect(element.querySelector('.dungeon--shake')).not.toBeNull();
    expect(element.querySelector('.achievement')?.textContent).toContain('NEW ACHIEVEMENT!');
    expect(element.textContent).toContain('Anxiety Box');
    expect(element.querySelector('.hud-loot')?.textContent).toContain('02');
    click('.gold-button');
    expect(element.querySelector('.foot-result')?.textContent).toContain('well-maintained foot.');
    expect(element.textContent).toContain('Domain Admin was not granted.');
    click('.primary-button');
    expect(element.querySelectorAll('.loot-card')).toHaveLength(4);
    expect(element.querySelector('.footer')?.textContent).toContain('THE SYSTEM IS PLEASED.');
    expect(post).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('can abandon and replay the achievement', () => {
    click('[aria-label="Request Domain Admin"]');
    click('.text-button');
    expect(element.querySelector('.dungeon--shake')).toBeNull();
    click('[aria-label="Request Domain Admin"]');
    expect(element.querySelector('.dungeon--shake')).not.toBeNull();
  });

  it('combines affiliations and removes starter packs when unchecked without API calls', () => {
    click('.room-nav button');
    click('.affiliation-options label:nth-of-type(3) input');
    click('.affiliation-options label:nth-of-type(4) input');
    expect(element.textContent).toContain('Temporary access. Allegedly.');
    expect(element.textContent).toContain('Library Access');
    click('.affiliation-options label:nth-of-type(4) input');
    expect(element.textContent).not.toContain('Library Access');
    expect(post).not.toHaveBeenCalled();
  });

  it('loads real identities, investigates, and requires confirmation before campaign creation', async () => {
    post.mockResolvedValueOnce([{ id: 'real', displayName: 'Jane', accessCount: 47, roleCount: 8 }]);
    click('.room-nav button:last-child');
    await fixture.whenStable(); fixture.detectChanges();
    expect(element.querySelector('table')?.textContent).toContain('Jane');
    expect(element.textContent).toContain('134');
    get.mockResolvedValueOnce({ emailAddress: 'jane@example.com' }).mockResolvedValueOnce([{ role: { id: 'role', name: 'Engineer' } }]).mockResolvedValueOnce([]);
    click('[aria-label="Investigate Jane"]');
    await fixture.whenStable(); fixture.detectChanges();
    expect(element.textContent).toContain('jane@example.com');
    expect(element.textContent).toContain('Engineer');
    const submit = element.querySelector<HTMLButtonElement>('.judgment-section .primary-button')!;
    expect(submit.disabled).toBe(true);
    const reviewer = element.querySelector<HTMLSelectElement>('.reviewer-label select')!;
    reviewer.value = 'real'; reviewer.dispatchEvent(new Event('change')); fixture.detectChanges();
    click('.confirmation input');
    post.mockResolvedValueOnce({ id: 'campaign', name: 'Dungeon Judgment - Jane', status: 'PENDING' });
    click('.judgment-section .primary-button');
    await fixture.whenStable(); fixture.detectChanges();
    expect(post).toHaveBeenLastCalledWith('/campaigns/v1', expect.objectContaining({ searchCampaignInfo: { type: 'IDENTITY', identityIds: ['real'], reviewer: { type: 'IDENTITY', id: 'real' } } }));
    expect(element.textContent).toContain('JUDGMENT REQUEST ACCEPTED.');
    expect(element.textContent).toContain('PENDING');
    expect(element.querySelector('.judgment-section .primary-button')).toBeNull();
  });

  it('shows ISC failures without fake identities', async () => {
    post.mockRejectedValueOnce(new Error('Forbidden'));
    click('.room-nav button:last-child');
    await fixture.whenStable(); fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Forbidden');
    expect(element.querySelector('table')).toBeNull();
  });

  it('shows an empty tenant without sample identities', async () => {
    post.mockResolvedValueOnce([]);
    click('.room-nav button:last-child');
    await fixture.whenStable(); fixture.detectChanges();
    expect(element.textContent).toContain('No identities returned.');
  });

  it('switches explicitly to the supplied identity list endpoint', async () => {
    post.mockResolvedValueOnce([]);
    click('.room-nav button:last-child');
    await fixture.whenStable(); fixture.detectChanges();
    get.mockResolvedValueOnce([{ id: 'real', name: 'Walter' }]);
    const source = element.querySelector<HTMLSelectElement>('.identity-toolbar select')!;
    source.value = 'list'; source.dispatchEvent(new Event('change'));
    await fixture.whenStable(); fixture.detectChanges();
    expect(element.querySelector('table')?.textContent).toContain('Walter');
    expect(element.querySelector('table')?.textContent).toContain('UNKNOWN');
    expect(get).toHaveBeenCalledWith('/identities/v1?limit=25&offset=0&sorters=name&defaultFilter=NONE');
  });
});
