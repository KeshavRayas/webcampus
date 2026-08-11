# QR Code Based Hall Ticket Verification System

## Overview

Students' hall tickets carry a QR code. Today that QR encodes the raw USN only.
This feature upgrades the QR to an **opaque, server-issued verification token** and
adds a **verification app** that faculty (invigilators), HODs, and Admins use to scan
a hall ticket and instantly see the student's photo, name, and per-course exam
eligibility (including reasons for ineligibility).

The admin activates the feature per academic term via **both a toggle and a date
window**. Everything is designed so that later the same scan flow can (a) mark exam
attendance and (b) bind the hall-ticket QR to the answer-script barcode per course.

## Current System (Baseline)

- QR today = raw `student.usn`, generated with the `qrcode` package in:
  - `packages/ui/src/lib/hall-ticket/html.ts` (SSR → PDF)
  - `packages/ui/src/lib/hall-ticket/template.tsx` (client preview fallback)
- All verification data (photo, name, dept, semester, section, per-course eligibility
  + reasons, freeze state) is already computed by
  `apps/api/src/services/shared/academic-eligibility.service.ts`
  (`getCourseEligibility` → `StudentEligibility`).
- Roles `"admin" | "hod" | "faculty"` exist in `packages/types/src/rbac.ts`;
  `protect({ role: Role | Role[] })` already supports role arrays
  (`packages/backend-utils/src/middlewares/protect.ts`).
- **No** settings/feature-flag model exists. **No** scanner library is installed
  (only `qrcode` for generation).
- `HallTicket` Prisma model is in `packages/db/prisma/schema.prisma` (line ~758),
  keyed by `@@unique([studentId, academicTermId, semesterId])`, with `isSent`,
  `sentAt`, `sentBy`.

## Decisions (Final)

| Question | Decision |
|---|---|
| QR payload | Opaque random token (`verificationToken`) **+ legacy USN fallback** |
| Activation scope | **Per academic term** (toggle + optional date window) |
| Scanner library | `html5-qrcode` (QR + Code128/Code39/EAN, live camera + image upload) |
| UI placement | Dedicated sidebar item per role (faculty, hod, admin) |
| Migrations | User runs migrations manually — **we only edit `schema.prisma`** |

### Opaque QR — what it does and doesn't do
Any QR is physically decodable by any reader. The token design ensures that when a
plain phone camera scans the ticket it reads meaningless random characters (no URL
opens, no USN/PII leaks), while only the in-app scanner resolves the token to a
verified student record.

## Architecture / Data Flow

```
Printed hall ticket
   └─ QR = WCHT_VERIFY|<verificationToken>   (opaque random token)
         └─ scanned by in-app scanner (html5-qrcode)
              └─ POST /verification/verify { token }
                   ├─ resolve token → HallTicket → student + term
                   ├─ check term's VerificationSetting (enabled && window)
                   ├─ recompute eligibility via academicEligibility
                   ├─ write VerificationLog
                   └─ return student snapshot + per-course eligibility
                        └─ render VALID / NOT ELIGIBLE / INACTIVE card
```

## Phases

### Phase 1 — Schema + QR payload (foundation)

**Schema (`packages/db/prisma/schema.prisma` only — no migration commands):**

```prisma
// add to HallTicket model:
verificationToken String? @unique

// new models:
model HallTicketVerificationSetting {
  id             String    @id @default(uuid())
  academicTermId String    @unique
  enabled        Boolean   @default(false)
  windowStartAt  DateTime?
  windowEndAt    DateTime?
  updatedById    String?
  updatedAt      DateTime  @updatedAt

  academicTerm AcademicTerm @relation(fields: [academicTermId], references: [id], onDelete: Cascade)

  @@index([academicTermId])
}

model HallTicketVerificationLog {
  id               String   @id @default(uuid())
  studentId        String
  academicTermId   String
  token            String?
  verifiedById     String?
  verifiedByRole   String?
  result           String // VALID | NOT_ELIGIBLE | NOT_SENT | NOT_FOUND | INACTIVE | WINDOW_CLOSED
  detail           String?
  createdAt        DateTime @default(now())

  student      Student      @relation(fields: [studentId], references: [id])
  academicTerm AcademicTerm @relation(fields: [academicTermId], references: [id])

  @@index([studentId])
  @@index([academicTermId])
  @@index([createdAt])
}
```

**QR payload threading (`packages/ui`):**
- `HallTicketTemplateData` gains `qrPayload: string`.
- `template.tsx`: drop the `QRCode.toDataURL(student.usn)` fallback; encode
  `qrPayload` instead (keep a USN fallback only when `qrPayload` is absent).
- `html.ts`: encode `data.qrPayload` (already async — swap the data passed to
  `QRCode.toDataURL`).
- `index.ts` / `hall-ticket-template.ts`: export updated types.

### Phase 2 — API

New files:
- `apps/api/src/services/shared/hall-ticket-verification.service.ts`
- `apps/api/src/controllers/verification/verification.controller.ts`
- `apps/api/src/routers/verification/verification.router.ts`
- `packages/schemas/src/coe/verification.schema.ts` (update `coe/index.ts` to export)

Modified:
- `apps/api/src/services/shared/hall-ticket.service.ts`:
  - in `send()`: generate `verificationToken` (crypto random) per upsert;
  - in `generatePdfHtml()`: lazily create the token if missing (covers admin
    preview/download) and pass `qrPayload` into `templateData`.
- `apps/api/src/app.ts`: `app.use("/verification", verificationRouter)`.

Routes (`protect({ role: ["admin","hod","faculty"], permissions: {} })`):
- `POST /verification/verify` — body `{ token }` **or** `{ usn, academicTermId }`
  (legacy). Steps: resolve → window check → eligibility → log → respond.
- `GET /verification/settings` (admin) — list/read per-term settings.
- `PATCH /verification/settings` (admin) — upsert `{ academicTermId, enabled,
  windowStartAt?, windowEndAt? }`.
- `GET /verification/logs` (admin) — paginated audit trail.

### Phase 3 — Web UI

New files:
- `apps/web/modules/verification/qr-scanner.tsx` (html5-qrcode: live camera,
  image-upload fallback, manual USN entry fallback)
- `apps/web/modules/verification/hall-ticket-verification-view.tsx`
- `apps/web/modules/verification/use-verification.ts`
- `apps/web/modules/admin/verification/use-verification-settings.ts`
- `apps/web/modules/admin/verification/admin-verification-settings-view.tsx`
- `apps/web/app/(protected)/faculty/verification/page.tsx`
- `apps/web/app/(protected)/hod/verification/page.tsx`
- `apps/web/app/(protected)/admin/verification/page.tsx`
- `apps/web/app/(protected)/admin/verification/settings/page.tsx`

Modified:
- `apps/web/modules/sidebar/sidebar-config.ts` — add sidebar items:
  - faculty: "Hall Ticket Verification" under Academics/Handling
  - hod: under Academics
  - admin: under Academics (plus "Verification Settings")
- `packages/ui/package.json` (and lockfile) — add `html5-qrcode`.

Result card states: VALID (green, photo + details), NOT ELIGIBLE (red + blocking
course reasons), NOT SENT, NOT FOUND, INACTIVE, WINDOW_CLOSED.

### Phase 4 — Testing

- Unit: `apps/api/src/services/shared/__tests__/hall-ticket-verification.service.test.ts`
  — token generate/lookup, activation window logic (before/inside/after), legacy
  USN fallback, eligibility mapping.
- E2E (Playwright): `packages/playwright-web/tests/verification.spec.ts` +
  helper in `tests/helpers/domains/` — uses manual USN entry (camera not
  headless-testable).
- Run `bun run check-types`, `bun run lint` after implementation.

### Phase 5 — Future (designed in, not built now)

- **Exam attendance**: `HallTicketVerificationLog` already records `studentId`,
  `verifiedById`, `createdAt` — the anchor for marking exam-day attendance from the
  same scan flow.
- **Answer-script barcode mapping**: `html5-qrcode` already decodes Code128/Code39/
  EAN. The same scanner component will later read the answer-script barcode and bind
  it to the hall-ticket token per course (one more table, e.g.
  `ExamAnswerScriptLink`). No scanner rework needed.

## File-by-File Change List

### Modified
| File | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | `HallTicket.verificationToken` + 2 new models |
| `packages/ui/src/lib/hall-ticket/template.tsx` | `qrPayload` in template data; encode token |
| `packages/ui/src/lib/hall-ticket/html.ts` | encode `qrPayload` |
| `packages/ui/src/lib/hall-ticket/index.ts` | export updated types |
| `packages/ui/src/lib/hall-ticket-template.ts` | re-export updated types |
| `packages/ui/package.json` | add `html5-qrcode` |
| `packages/schemas/src/coe/index.ts` | export verification schema |
| `apps/api/src/services/shared/hall-ticket.service.ts` | token gen in `send()` + lazy in `generatePdfHtml()`, `qrPayload` |
| `apps/api/src/app.ts` | mount `/verification` router |
| `apps/web/modules/sidebar/sidebar-config.ts` | per-role sidebar items |

### Added
| File | Purpose |
|---|---|
| `packages/schemas/src/coe/verification.schema.ts` | zod schemas (verify, settings, log) |
| `apps/api/src/services/shared/hall-ticket-verification.service.ts` | core logic |
| `apps/api/src/controllers/verification/verification.controller.ts` | HTTP handlers |
| `apps/api/src/routers/verification/verification.router.ts` | routes + role guard |
| `apps/api/src/services/shared/__tests__/hall-ticket-verification.service.test.ts` | unit tests |
| `apps/web/modules/verification/qr-scanner.tsx` | scanner component |
| `apps/web/modules/verification/hall-ticket-verification-view.tsx` | shared view |
| `apps/web/modules/verification/use-verification.ts` | verify hook |
| `apps/web/modules/admin/verification/use-verification-settings.ts` | settings hook |
| `apps/web/modules/admin/verification/admin-verification-settings-view.tsx` | settings UI |
| `apps/web/app/(protected)/faculty/verification/page.tsx` | faculty route |
| `apps/web/app/(protected)/hod/verification/page.tsx` | HOD route |
| `apps/web/app/(protected)/admin/verification/page.tsx` | admin route |
| `apps/web/app/(protected)/admin/verification/settings/page.tsx` | admin settings route |
| `packages/playwright-web/tests/verification.spec.ts` | e2e |
| `packages/playwright-web/tests/helpers/domains/verification.ts` | e2e helpers |

## Migration Note
We only edit `packages/db/prisma/schema.prisma`. **No `db:migrate`/`db:generate`
commands are run by the assistant** — the user runs migrations manually.

## Notes / Risks
- Camera requires **HTTPS** (or localhost) — flag for deployment.
- The API app does not hot-reload (`bun --watch` not set) — restart API after
  backend changes.
- Legacy USN-only printed tickets keep verifying via the `{ usn, academicTermId }`
  fallback; newly generated tickets use the token.
- `verificationToken` is generated server-side (random) so it cannot be forged to
  resolve to another student.
