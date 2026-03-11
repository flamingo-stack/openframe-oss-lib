# Duplicate Components Audit

> Generated: 2026-03-11

## Summary

| Category | Duplicate Count | Priority |
|----------|----------------|----------|
| UI components (root vs /ui) | 27 | HIGH |
| Icons (root vs /icons) | 39+ | HIGH |
| Icons (/icons vs /icons-v2-generated) | 30+ | MEDIUM |
| Skeleton/Loading overlaps | 15+ | MEDIUM |
| Stub files (obsolete?) | 6 + 6 markers | LOW |
| Table utility overlaps | 2 | LOW |

---

## 1. UI Components — Root vs `/ui` Folder (27 duplicates)

Components exist in **both** `src/components/` and `src/components/ui/` with identical or near-identical code. The `/ui` versions are canonical.

| File | Root | UI (canonical) | Notes |
|------|------|----------------|-------|
| accordion.tsx | `components/` | `components/ui/` | Identical |
| alert-dialog.tsx | `components/` | `components/ui/` | Identical |
| alert.tsx | `components/` | `components/ui/` | Identical |
| aspect-ratio.tsx | `components/` | `components/ui/` | Identical |
| badge.tsx | `components/` | `components/ui/` | Identical |
| breadcrumb.tsx | `components/` | `components/ui/` | Identical |
| checkbox.tsx | `components/` | `components/ui/` | Identical |
| chevron-button.tsx | `components/` | `components/ui/` | Identical |
| custom-icons.tsx | `components/` | `components/ui/` | Identical |
| dialog.tsx | `components/` | `components/ui/` | Identical |
| dropdown-menu.tsx | `components/` | `components/ui/` | Identical |
| icons-block.tsx | `components/` | `components/ui/` | Identical |
| input.tsx | `components/` | `components/ui/` | **Different** — root has custom styling |
| label.tsx | `components/` | `components/ui/` | Identical |
| menubar.tsx | `components/` | `components/ui/` | Identical |
| navigation-menu.tsx | `components/` | `components/ui/` | Identical |
| progress.tsx | `components/` | `components/ui/` | Identical |
| radio-group.tsx | `components/` | `components/ui/` | Identical |
| select.tsx | `components/` | `components/ui/` | Identical |
| separator.tsx | `components/` | `components/ui/` | Identical |
| skeleton.tsx | `components/` | `components/ui/` | **Different** — ui has 8+ variants |
| slider.tsx | `components/` | `components/ui/` | Identical |
| square-avatar.tsx | `components/` | `components/ui/` | Identical |
| switch.tsx | `components/` | `components/ui/` | Identical |
| tabs.tsx | `components/` | `components/ui/` | Identical |
| textarea.tsx | `components/` | `components/ui/` | Identical |
| toggle.tsx | `components/` | `components/ui/` | Identical |

**Action**: Remove root-level versions, update all imports to `components/ui/`.

---

## 2. Icon Components — Root vs `/icons` Folder (39+ duplicates)

Icon files exist in **both** `src/components/` (root) and `src/components/icons/`. The `/icons` versions typically have enhanced prop support (e.g. `color`, `size` props).

- about-icon.tsx
- check-circle-icon.tsx
- claude-icon.tsx
- coins-icon.tsx
- community-hub-icon.tsx
- community-icon.tsx
- compare-icon.tsx
- custom-external-link-icon.tsx
- custom-fork-icon.tsx
- custom-license-icon.tsx
- custom-star-icon.tsx
- custom-time-icon.tsx
- donut-icon.tsx
- edit-profile-icon.tsx
- elestio-logo.tsx
- empty-vendor-icon.tsx
- flamingo-logo.tsx
- github-icon.tsx
- google-logo.tsx
- hamburger-icon.tsx
- hubspot-icon.tsx
- icon-utils.tsx
- menu-icon.tsx
- minus-circle-icon.tsx
- moon-icon.tsx
- ms-icon.tsx
- open-source-icon.tsx
- openframe-logo.tsx
- openmsp-logo.tsx
- plus-circle-icon.tsx
- reddit-icon.tsx
- send-icon.tsx
- slack-icon.tsx
- sun-icon.tsx
- user-icon.tsx
- vendor-directory-icon.tsx
- vendors-icon.tsx
- x-icon.tsx
- x-logo.tsx

**Action**: Keep `/icons` versions (enhanced), remove root-level duplicates, update imports.

---

## 3. Icons — `/icons` vs `/icons-v2-generated` (30+ overlaps)

These two icon systems have overlapping icons with **completely different implementations** (different SVGs, different prop APIs).

| Icon | `/icons/` | `/icons-v2-generated/` |
|------|-----------|----------------------|
| alert-triangle-icon | Custom SVG | Generated, `size` prop |
| buildings-icon | Custom | Generated |
| check-circle-icon | Custom | Generated |
| coins-icon | Custom | Generated |
| eye-icon | Custom | Generated |
| facebook-icon | Custom | Generated (brand-logos/) |
| figma-icon | Custom | Generated |
| file-check-icon | Custom | Generated |
| folder-shield-icon | Custom | Generated |
| github-icon | 15x14px, `fill` | 24px, multi-path, `size` |
| hand-dollar-icon | Custom | Generated |
| hotel-icon | Custom | Generated |
| image-icon | Custom | Generated |
| info-circle-icon | Custom | Generated |
| instagram-icon | Custom | Generated (brand-logos/) |
| linkedin-icon | Custom | Generated (brand-logos/) |
| minus-circle-icon | Custom | Generated |
| moon-icon | Custom | Generated |
| network-icon | Custom | Generated |
| package-icon | Custom | Generated |
| plus-circle-icon | Custom | Generated |
| search-icon | Custom | Generated |
| shape-circle-dash-icon | Custom | Generated |
| shield-check-icon | Custom | Generated |
| shield-icon | Custom | Generated |
| shield-lock-icon | Custom | Generated |
| sliders-icon | Custom | Generated |
| thumbs-down-icon | Custom | Generated |
| thumbs-up-icon | Custom | Generated |
| user-icon | Custom | Generated |

**Action**: Decide on one icon system. Options:
- **A)** Standardize on `/icons/` (hand-crafted, fewer)
- **B)** Migrate to `/icons-v2-generated/` (auto-generated, 1600+ icons, consistent API)

---

## 4. Skeleton / Loading Component Overlaps

Multiple skeleton implementations with overlapping purposes:

| Location | Component | Purpose |
|----------|-----------|---------|
| `components/skeleton.tsx` | Skeleton | Simple animated div (`bg-muted/60`) |
| `components/ui/skeleton.tsx` | Skeleton + 8 variants | Full system (Text, Card, Grid, Button, Heading, List, Nav) |
| `components/dynamic-skeleton.tsx` | DynamicSkeleton | Dynamic grid skeleton |
| `components/loading/` | 12 specialized files | CardSkeleton, DeviceCardSkeleton, UnifiedSkeleton, etc. |
| `components/ui/table/table-skeleton.tsx` | TableSkeleton | Table-specific |
| `components/ui/table/query-report-table/...skeleton.tsx` | QueryReportTableSkeleton | Report-specific |

**Action**: Consolidate — use `ui/skeleton.tsx` as the base, evaluate if specialized loading components can use its variants.

---

## 5. Stub Files (Migration Leftovers)

Stub files that may no longer be needed if real implementations exist:

| Stub | Marker | Notes |
|------|--------|-------|
| `components/auth-stub.tsx` | `.auth-stub.md` | Real auth in parent project |
| `components/icons-stub.tsx` | `.icons-stub.md` | Icons exist in `/icons/` |
| `components/join-waitlist-button-stub.tsx` | `.join-waitlist-button-stub.md` | Real button exists |
| `components/user-summary-stub.tsx` | `.user-summary-stub.md` | Real in features |
| `components/ui/pagination-stub.tsx` | `.pagination-stub.md` | `pagination.tsx` exists |
| `components/ui/responsive-icons-block-stub.tsx` | `.responsive-icons-block-stub.md` | `icons-block.tsx` exists |

**Action**: Verify real implementations are complete, then remove stubs and marker `.md` files.

---

## 6. Table Utility / Type Overlaps

| File | Location |
|------|----------|
| utils.ts | `components/ui/table/utils.ts` |
| utils.ts | `components/ui/table/query-report-table/utils.ts` |
| types.ts | `components/ui/table/types.ts` |
| types.ts | `components/ui/table/query-report-table/types.ts` |

**Action**: Audit for shared logic; consolidate if overlapping.

---

## Recommended Cleanup Order

1. **Phase 1 — Root UI duplicates** (27 files): Safest win, clearly identical files
2. **Phase 2 — Root icon duplicates** (39 files): `/icons/` versions are strictly better
3. **Phase 3 — Stub removal** (6 files + 6 markers): Verify and remove
4. **Phase 4 — Skeleton consolidation**: Requires careful import tracing
5. **Phase 5 — Icon system unification** (`/icons` vs `/icons-v2-generated`): Architectural decision needed

## Scale

- **~100 files** can be safely removed (root UI + root icons + stubs)
- **~30 icons** need architectural decision (which icon system to keep)
- **~15 skeleton files** need consolidation review
