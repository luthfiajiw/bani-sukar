# Graph Report - bani-sukar  (2026-11-22)

## Corpus Check
- Corpus is ~42,084 words - fits in a single context window. You may not need a graph.

## Summary
- 615 nodes · 2130 edges · 28 communities (22 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26

## God Nodes (most connected - your core abstractions)
1. `cn()` - 111 edges
2. `react` - 46 edges
3. `UserManagement()` - 42 edges
4. `Button()` - 42 edges
5. `AddChildDialog()` - 33 edges
6. `RelationEditor()` - 33 edges
7. `next` - 32 edges
8. `AddSpouseDialog()` - 31 edges
9. `lucide-react` - 31 edges
10. `PersonForm()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `ErrorPage()` --calls--> `Button()`  [EXTRACTED]
  app/error.tsx → components/ui/button.tsx
- `handleConfirmDelete()` --calls--> `deletePersonAction()`  [EXTRACTED]
  components/admin/delete-person-dialog.tsx → features/family/actions.ts
- `handleRemove()` --calls--> `removePersonPhotoAction()`  [EXTRACTED]
  components/admin/person-photo-field.tsx → features/family/actions.ts
- `BranchFilterProps` --references--> `Person`  [EXTRACTED]
  components/tree/branch-filter.tsx → features/family/types.ts
- `UnionNodeComponent()` --calls--> `cn()`  [EXTRACTED]
  components/tree/union-node.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (28 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (96): AdminAnggotaPage(), AnggotaDirectoryContent(), AnggotaDirectorySkeleton(), SearchParamsValue, generateMetadata(), PersonDetailContent(), PersonProfilePageProps, UNION_STATUS_META (+88 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (41): NewAnggotaPage(), EditAnggotaContent(), EditAnggotaPage(), EditPersonSkeleton(), AdminAuthGate(), AdminLayout(), AdminShellSkeleton(), AdminPenggunaPage() (+33 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (47): DeletePersonDialog(), handleConfirmDelete(), DeletePersonDialogProps, PendingPhotoUpload, PersonPhotoField(), handleDrop(), handleInputChange(), handleRemove() (+39 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (28): adminUsers, client, db, globalForDb, isDbAvailable(), genderEnum, personsRelations, unionsRelations (+20 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (35): handleSubmit(), handleSubmit(), resetForm(), handleSave(), handleDeleteUnion(), handleMoveChild(), handleUpdateUnionStatus(), handleAddAdmin() (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (27): AddChildDialogProps, UnionOption, AddSpouseDialogProps, PersonFormProps, PersonPhotoFieldProps, TreeSearchProps, getBranches(), getBranchRootId() (+19 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (28): RelationEditorProps, UserManagementProps, persons, unions, buildGraph(), choosePrimaryParent(), compareChildren(), compareUnions() (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (26): AdminHeaderMenu(), handleSignOut(), AdminInitialsCircle(), getAdminInitials(), handleSignOut(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent() (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (19): BranchFilter(), BranchFilterProps, GENERATION_PILLS, AppNode, FamilyCanvasInner(), FamilyCanvasProps, nodeTypes, horizontalHandleStyle (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (23): dependencies, @aws-sdk/client-s3@^3.1175.0, clsx@^2.1.1, cmdk@^1.1.1, drizzle-orm@^0.45.4, @hookform/resolvers@^7.0.7, jose@^6.2.18, lucide-react@^1.77.0 (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (20): NAV_ITEMS, SiteHeaderClient(), SiteHeaderShell(), SiteHeaderWithPathname(), emptySubscribe(), Sheet(), SheetClose(), SheetContent() (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (20): devDependencies, tailwindcss@4.3.3, @tailwindcss/turbopack@4.3.3, tsx@^4.23.15, @types/node@^22.20.5, @types/react@^19, @types/react-dom@^19, typescript@^5 (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (15): getAncestors(), traverse(), assertNoCycle(), assertNotSelfParent(), canDeletePerson(), dateStringSchema, nullableTrimmedString, ParsedPersonInput (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (11): emptySubscribe(), PopoverAnchor(), PopoverContent(), PopoverContentProps, PopoverContext, PopoverContextValue, PopoverProps, PopoverTrigger() (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.30
Nodes (10): AdminPaginationProps, ALLOWED_PAGE_SIZES, AllowedPageSize, buildPageNumbers(), buildPaginationHref(), DEFAULT_PAGE_SIZE, paginateItems(), PaginationResult (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.23
Nodes (11): DialogClose(), DialogContentProps, DialogContext, DialogContextValue, DialogOverlay(), DialogPortal(), DialogProps, DialogTriggerProps (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.27
Nodes (8): "admin_users", "persons", persons_full_name_idx, persons_parent_union_birth_order_uniq, persons_parent_union_id_idx, "unions", unions_husband_id_idx, unions_wife_id_idx

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (10): scripts, build, db:generate, db:migrate, db:seed, db:studio, dev, lint (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (6): handleSubmit(), resetForm(), handleSaveParentUnion(), handleUnlinkChild(), handleUnlinkParents(), setParentsAction()

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (4): dotenv@^18.0.10, drizzle-kit@^0.31.11, dotenv, drizzle-kit

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^9, eslint-config-next@16.4.6, eslint, eslint-config-next

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 0` to `Community 1`, `Community 2`, `Community 7`, `Community 8`, `Community 10`, `Community 14`, `Community 16`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07996801279488205 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Community 0` to `Community 1`, `Community 2`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 14`, `Community 16`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1025974025974026 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 22`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08874912648497554 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09388335704125178 - nodes in this community are weakly interconnected._