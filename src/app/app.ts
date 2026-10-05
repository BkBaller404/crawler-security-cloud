import { afterNextRender, Component, computed, ElementRef, inject, Injector, PendingTasks, signal, viewChild } from '@angular/core';
import { SailpointPluginService } from '@core';
import { LucideArrowLeft, LucideArrowUpRight, LucideTriangleAlert } from '@lucide/angular';
import { FormsModule } from '@angular/forms';
import { apiError, DungeonCampaign, DungeonIdentity, DungeonService, IdentityInvestigation } from './core/dungeon.service';

type Screen = 'affiliations' | 'catalog' | 'success' | 'achievement' | 'foot' | 'naughty' | 'investigation';
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

interface Loot {
  id: string;
  name: string;
  rarity: Rarity;
  category: string;
  description: string;
  verdict: string;
  permission: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, LucideArrowLeft, LucideArrowUpRight, LucideTriangleAlert],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly plugin = inject(SailpointPluginService);
  private readonly dungeon = inject(DungeonService);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly injector = inject(Injector);
  private readonly stateHeading = viewChild<ElementRef<HTMLHeadingElement>>('stateHeading');

  protected readonly crawler = computed(() => this.plugin.context()?.user.displayName || 'JDoe');
  protected readonly connected = computed(() => this.plugin.status() === 'ready');
  protected readonly screen = signal<Screen>('affiliations');
  protected readonly affiliations = [
    { id: 'employee', name: 'Employee', title: 'Employee Starter Pack', items: ['Microsoft 365', 'Employee Portal'], commentary: 'You work here. That explains some things.' },
    { id: 'vendor', name: 'Vendor', title: 'Vendor Starter Pack', items: ['Vendor Portal', 'External Collaboration'], commentary: 'I\'ve got my eye on you.' },
    { id: 'contractor', name: 'Contractor', title: 'Contractor Starter Pack', items: ['Microsoft 365', 'Slack', 'VPN'], commentary: 'Temporary access. Allegedly.' },
    { id: 'student', name: 'Student', title: 'Birthright Loot Acquired', items: ['Student Email', 'Learning Management System', 'Library Access', 'Campus Wi-Fi'], commentary: 'Congratulations. You may now learn things.' },
  ];
  protected readonly selectedAffiliations = signal<string[]>([]);
  protected readonly birthright = computed(() => this.affiliations.filter(item => this.selectedAffiliations().includes(item.id)));
  protected readonly identities = signal<DungeonIdentity[]>([]);
  protected readonly identitiesLoading = signal(false);
  protected readonly identitiesError = signal('');
  protected readonly identitySource = signal<'search' | 'list'>('search');
  protected readonly identityFilter = signal('');
  protected readonly visibleIdentities = computed(() => {
    const query = this.identityFilter().trim().toLowerCase();
    return this.identities().filter(item => `${item.name} ${item.department}`.toLowerCase().includes(query));
  });
  protected readonly selectedIdentity = signal<DungeonIdentity | null>(null);
  protected readonly investigation = signal<IdentityInvestigation | null>(null);
  protected readonly investigationLoading = signal(false);
  protected readonly investigationError = signal('');
  protected readonly reviewerId = signal('');
  protected readonly judgmentConfirmed = signal(false);
  protected readonly campaignLoading = signal(false);
  protected readonly campaignError = signal('');
  protected readonly campaigns = signal<Record<string, DungeonCampaign>>({});
  protected readonly currentCampaign = computed(() => this.campaigns()[this.selectedIdentity()?.id ?? ''] ?? null);
  protected readonly selectedItem = signal<Loot | null>(null);
  protected readonly acquired = signal<string[]>([]);
  protected readonly mood = signal<'indifferent' | 'concerned' | 'delighted'>('indifferent');
  protected readonly boxOpened = signal(false);
  protected readonly loot: readonly Loot[] = [
    { id: 'github', name: 'GitHub Developer', rarity: 'common', category: 'Source control', description: 'With great commits comes great blame.', verdict: 'A perfectly reasonable request. Boring.', permission: 'Repository development access' },
    { id: 'aws', name: 'AWS Developer', rarity: 'rare', category: 'Cloud infrastructure', description: 'The cloud is just someone else\'s dungeon.', verdict: 'This seems excessive.', permission: 'Development environment access' },
    { id: 'database', name: 'Production Database', rarity: 'epic', category: 'Production data', description: 'Those tables are not a sandbox.', verdict: 'Interesting.', permission: 'Production database access' },
    { id: 'admin', name: 'Domain Admin', rarity: 'legendary', category: 'The forbidden privilege', description: 'Every door. Every key. Every bad idea.', verdict: 'Absolutely fucking not.', permission: 'Unrestricted domain access' },
  ];

  protected requestAccess(item: Loot): void {
    this.selectedItem.set(item);
    if (item.rarity === 'legendary') {
      this.mood.set('delighted');
      this.show('achievement');
      return;
    }
    this.acquired.update(items => items.includes(item.id) ? items : [...items, item.id]);
    if (item.rarity === 'epic' || item.id === 'aws') this.mood.set('concerned');
    this.show('success');
  }

  protected openBox(): void {
    if (this.screen() !== 'achievement') return;
    this.boxOpened.set(true);
    this.show('foot');
  }

  protected returnToCatalog(): void {
    if (!this.selectedAffiliations().length) { this.show('affiliations'); return; }
    this.show('catalog');
  }

  protected chooseAffiliations(): void { this.show('affiliations'); }

  protected toggleAffiliation(id: string, checked: boolean): void {
    this.selectedAffiliations.update(items => checked ? [...new Set([...items, id])] : items.filter(item => item !== id));
  }

  protected async enterDungeon(): Promise<void> {
    this.show('naughty');
    await this.loadIdentities();
  }

  protected async loadIdentities(): Promise<void> {
    if (this.identitiesLoading()) return;
    const complete = this.pendingTasks.add();
    this.identitiesLoading.set(true);
    this.identitiesError.set('');
    this.identities.set([]);
    try {
      this.identities.set(await (this.identitySource() === 'search' ? this.dungeon.searchIdentities() : this.dungeon.listIdentities()));
    } catch (error) { this.identitiesError.set(apiError(error)); }
    finally { this.identitiesLoading.set(false); complete(); }
  }

  protected async investigate(identity: DungeonIdentity): Promise<void> {
    if (this.campaignLoading() || this.investigationLoading()) return;
    const complete = this.pendingTasks.add();
    this.selectedIdentity.set(identity);
    this.investigation.set(null);
    this.investigationError.set('');
    this.campaignError.set('');
    this.reviewerId.set('');
    this.judgmentConfirmed.set(false);
    this.investigationLoading.set(true);
    this.show('investigation');
    try {
      const result = await this.dungeon.investigate(identity.id);
      if (this.selectedIdentity()?.id === identity.id) this.investigation.set(result);
    } catch (error) { this.investigationError.set(apiError(error)); }
    finally { this.investigationLoading.set(false); complete(); }
  }

  protected backToNaughtyList(): void { this.show('naughty'); }

  protected async beginJudgment(): Promise<void> {
    const identity = this.selectedIdentity();
    if (!identity || !this.connected() || !this.judgmentConfirmed() || !this.reviewerId().trim() || this.campaignLoading() || this.currentCampaign()) return;
    const complete = this.pendingTasks.add();
    this.campaignLoading.set(true);
    this.campaignError.set('');
    try {
      const campaign = await this.dungeon.createJudgment(identity, this.reviewerId());
      this.campaigns.update(items => ({ ...items, [identity.id]: campaign }));
    } catch (error) {
      this.campaignError.set(`${apiError(error)} Check ISC Certifications before retrying; an interrupted response may still have created a campaign.`);
      this.judgmentConfirmed.set(false);
    } finally { this.campaignLoading.set(false); complete(); }
  }

  private show(screen: Screen): void {
    this.screen.set(screen);
    afterNextRender(() => this.stateHeading()?.nativeElement.focus(), { injector: this.injector });
  }
}
