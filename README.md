# Crawler Security Cloud

A three-room dungeon-themed governance experience, built as a SailPoint ISC full-page UI plugin with Angular 21 and one local state machine.

**Affiliations, birthright packs, and optional access requests are simulated.** No roles are created and no access is provisioned. The Naughty List loads real ISC identities, and investigation retrieves real details, role assignments, and entitlements. BEGIN JUDGMENT creates a real certification campaign only after reviewer selection and explicit confirmation.

The room flow lives in `src/app/app.ts`, `app.html`, and `app.scss`; typed API operations live in `src/app/core/dungeon.service.ts`. All requests reuse the existing plugin SDK and host authentication. There is no separate OAuth flow, token input, route interception, or external asset dependency. Standalone development uses JDoe and shows a connection error for real-data operations, never fabricated identities.

## Commands

```bash
npm install
npm start                      # HTTPS preview at https://localhost:4200
npm run build                  # production plugin bundle
npm test -- --watch=false      # Angular / Vitest tests
```

Trust the local development certificate in your browser for the HTTPS preview. If port 4200 is occupied, use `npm start -- --port 4201` for a standalone preview; keep the plugin manifest port aligned when linking to ISC.

## Demo sequence

1. Choose Contractor and Student together. Their simulated starter packs appear immediately. Continue to the loot store.
2. Request GitHub Developer, AWS Developer, or Production Database. Each has its own commentary. Return to the store.
3. Request Domain Admin: screen shake, new achievement, Gold Auditor Anxiety Box. Open it for the foot reveal.
4. Enter the dungeon: up to 25 real identities from ISC Search. The source menu also supports the supplied Identity List API.
5. Investigate an identity: real details, role assignments, and the first 50 entitlements. Partial endpoint failures are displayed independently.
6. In a suitable demo tenant only, select a real reviewer, confirm campaign creation, and click BEGIN JUDGMENT. Show the accepted campaign ID and status, then open ISC Certifications to check generation.

Employee, Vendor, Contractor, and Student are independent checkboxes. Unchecking an affiliation removes its simulated pack. Optional loot never double-counts repeat requests; Domain Admin is never granted. State changes focus their heading and animations respect reduced-motion preferences.

## Real API contracts

- `POST /search/v1?limit=25`: identities index, wildcard query, displayName/id sorting. Fetches one bounded page, not the entire tenant.
- `GET /identities/v1?limit=25&offset=0&sorters=name&defaultFilter=NONE`: explicit alternate list source. This endpoint does not supply Search access counts.
- `GET /identities/v1/{id}`: selected identity details.
- `GET /identities/v1/{id}/role-assignments`: selected identity's role assignment references.
- `GET /entitlements/v1/identities/{id}/entitlements?limit=50&offset=0`: bounded entitlement page. Supports both nested `objectRef` and flat references shown in the supplied documentation. Requires ORG_ADMIN or API authority in addition to scope.
- `POST /campaigns/v1`: SEARCH campaign with `searchCampaignInfo.type: IDENTITY`, one selected `identityIds` entry, and a selected IDENTITY reviewer. No access constraints are sent, so the demo does not accidentally exclude identities without a role or access profile.

Dungeon score is a local entertainment heuristic: `accessCount * 2 + roleCount * 5`. Mood uses access count: over 30 NAUGHTY, over 15 SUSPICIOUS, otherwise BORING. Absent counts remain Unknown; zero is not substituted. This is not SailPoint's risk model. Listed entitlements and role assignments are shown separately and never misrepresented as a complete access count.

Campaign creation is asynchronous (202). The UI reports acceptance and the returned status, not active review completion. Deadline is 14 days; auto-revocation, notifications, and recommendations are disabled. No activation API is called. Duplicate creation is blocked while submitting and after acceptance within this session. On an ambiguous network failure, check ISC before retrying; this is not cross-session idempotency.

## Permissions

The manifest declares Search read (`sp:search:read`), identity read (`idn:identity:read`), entitlement read (`idn:entitlement:read`), and campaign management (`idn:campaign:manage`, `idn:campaign-filter:read`). The Search scope is verified against SailPoint's published resource-centric OpenAPI schema. Campaign-filter read is included conservatively because the supplied campaign operation lists it and a default filter may apply. No broad `sp:scopes:all` scope is requested.

Scopes do not override user authority. Confirm identity visibility, entitlement API authority, campaign-management permissions, and reviewer eligibility in your tenant. To run read-only, remove the campaign scopes and avoid the judgment action. The server remains the authority for authorization.

## Run inside ISC

The alias remains `crawler-accessrequest`; the slot remains `full-page`. Use the SailPoint CLI with your authenticated tenant:

```bash
sail ui-plugins create         # only if the instance is not already registered
sail ui-plugins push-manifest  # update an existing instance's label and scopes
sail ui-plugins link           # with npm start running
```

Accept the local HTTPS certificate before opening the linked plugin in ISC. After changing scopes, run `push-manifest` and relink to refresh the host's scoped token. The HUD changes from STANDALONE DEMO to ISC LINK ESTABLISHED when the host context is ready; that does not guarantee every endpoint is authorized.

For deployment:

```bash
npm run build
sail ui-plugins upload
```

The bundle is written to `dist/crawler-accessrequest/browser`. Asset URLs remain relative for SailPoint's CDN. Tenant registration, linking, and deployment require your SailPoint CLI session; these commands are not run automatically.

## Additional resources

- [`SAILPOINT_PLUGIN_GUIDE_ANGULAR.md`](./SAILPOINT_PLUGIN_GUIDE_ANGULAR.md) — plugin guide (SDK usage, config, deployment)
- [SailPoint UI Plugins](https://developer.sailpoint.com/docs/ui-plugins/)
- [Angular CLI reference](https://angular.dev/tools/cli)
