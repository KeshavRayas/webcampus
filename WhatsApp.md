# WhatsApp Broadcast Feature

Admin-only WhatsApp messaging for CIE marks, balance fee, annual fee, and
parent-teacher meeting reminders, using Trustsignal's bulk WhatsApp API.

Send endpoint: `POST https://wpapi.trustsignal.io/api/v1/whatsapp/bulk?api_key=APIKEY`

Request body:

```json
{
  "sender": "SENDER_NUMBER",
  "template_id": "TEMPLATE_ID",
  "receivers": [
    { "to": "RECIPIENT_NUMBER", "sample": { "bodyvar": ["V1", "V2"] } }
  ]
}
```

## Overall Workflow

1. Admin stores message templates (preview text + external template id +
   ordered variable mapping) in the DB.
2. Admin composes a broadcast:
   Filter by **term → department → semester → section(s)** →
   select template(s) → choose scope (**student / parent / both**) →
   category-specific config (CIE number + subjects, fee deadline, PTM
   date/time/venue) → load recipients → **all / custom** selection →
   **preview** → **send**.
3. Backend resolves recipients from the DB (name, phone, per-category data),
   builds the Trustsignal payload, sends it, and logs a per-recipient report.
4. Reports (success / failure / skipped) are viewable under a "Send Reports"
   tab.

The pipeline is channel-agnostic: only the final payload/sender is
WhatsApp-specific, so SMS/email can reuse the same recipient + variable
resolution.

### Filter chain
`AcademicTerm → Department → Semester → Section(s) (multi) → Template(s)`

### Audience scope
- `student` → send to student's phone using the **student template**
- `parent` → send to parent's phone using the **parent template**
- `both` → admin picks **two templates** (student + parent, same category);
  student template → student phone, parent template → parent phone

Parent phone fallback: `fatherNumber ?? motherNumber ?? guardianNumber`.
Student phone: `primaryPhoneNumber ?? secondaryPhoneNumber`.
Recipients with no phone are logged as `SKIPPED`.

### Category-specific send config
- **CIE marks**: CIE number (1 / 2 / 3) + subjects (All / Custom course list).
  One message per student × subject (a student can appear multiple times).
- **Balance fee**: payment deadline (ad-hoc input).
- **Annual fee**: payment deadline (ad-hoc input).
- **PTM**: date, time, venue (ad-hoc inputs).

### Variable mapping (per template)
When creating a template the admin defines an **ordered list of variables**
(position = `bodyvar` order) and picks a **field source** for each from the
category's allowed list. The message body is free text with `{token}`
placeholders (e.g. `{student_name}`, `{cie_marks}`) used only for preview; the
real send uses `template_id` + `bodyvar` array in the configured order.

Field sources by category:

| Category            | Field sources                                                                 |
|---------------------|-------------------------------------------------------------------------------|
| Common (all)        | `STUDENT_NAME`, `USN`, `DEPARTMENT`, `SECTION`, `SEMESTER`, `ACADEMIC_YEAR`    |
| CIE                 | `SUBJECT_CODE`, `SUBJECT_NAME`, `CIE_MARKS`, `CIE_MAX`                          |
| Balance fee         | `FEE_DEMAND`, `AMOUNT_PAID`, `BALANCE`, `DEADLINE`                              |
| Annual fee          | `FEE_AMOUNT`, `DEADLINE`                                                        |
| PTM                 | `PTM_DATE`, `PTM_TIME`, `PTM_VENUE`                                             |

CIE marks come from `Mark` (`cie1/cie2/cie3` selected by send-time CIE number);
max marks from the matching `AssessmentTemplate` (THEORY, sequence N) with
fallback to `Course` cie/theory max fields.

### Send & reporting
- Send is executed in chunks (~500 receivers/request) as a safeguard.
- Each send persists a `MessageCampaign` + per-recipient `MessageCampaignReceipt`.
- Provider response JSON is stored raw; per-recipient status is derived when
  parseable, otherwise the overall HTTP result is used (response shape TBD —
  user to confirm).

## Files Changed / Created

### DB / Schema (NO commands run — no migrate, no generate)
- `packages/db/prisma/schema.prisma` — add enums + models (below). ONLY this file
  is changed; nothing else in this step.
- User runs `bun run db:generate` and `bun run db:migrate` MANUALLY.
  The build phase for API/UI code starts only after that, so new-model types
  are available for typechecking.

New Prisma models/enums:

```
enum MessageCategory        { CIE, BALANCE_FEE, ANNUAL_FEE, PARENT_TEACHER_MEETING }
enum MessageRecipientType   { STUDENT, PARENT }
enum MessageScope           { STUDENT, PARENT, BOTH }
enum MessageFieldSource     { STUDENT_NAME, USN, DEPARTMENT, SECTION, SEMESTER,
                              ACADEMIC_YEAR, SUBJECT_CODE, SUBJECT_NAME, CIE_MARKS,
                              CIE_MAX, FEE_DEMAND, AMOUNT_PAID, BALANCE, FEE_AMOUNT,
                              DEADLINE, PTM_DATE, PTM_TIME, PTM_VENUE }
enum MessageChannel         { WHATSAPP }
enum ReceiptStatus          { SUCCESS, FAILURE, SKIPPED }

model MessageTemplate {
  id                 String    @id @default(uuid())
  name               String
  category           MessageCategory
  recipientType      MessageRecipientType
  externalTemplateId String
  messageBody        String
  isActive           Boolean   @default(true)
  createdById        String
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  variables          MessageTemplateVariable[]
  studentCampaigns   MessageCampaign[]  @relation("StudentTemplate")
  parentCampaigns    MessageCampaign[]  @relation("ParentTemplate")
  receipts           MessageCampaignReceipt[]
}

model MessageTemplateVariable {
  id          String             @id @default(uuid())
  templateId  String
  position    Int
  label       String
  fieldSource MessageFieldSource
  template    MessageTemplate    @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, position])
}

model MessageCampaign {
  id                String             @id @default(uuid())
  channel           MessageChannel     @default(WHATSAPP)
  category          MessageCategory
  scope             MessageScope       // STUDENT | PARENT | BOTH
  filterSnapshot    Json
  cieNumber         Int?
  subjectIds        Json?
  adHocData         Json?              // deadline, ptm date/time/venue
  studentTemplateId String?
  parentTemplateId  String?
  sentById          String
  totalReceivers    Int
  successCount      Int
  failureCount      Int
  skippedCount      Int
  providerResponse  Json?
  createdAt         DateTime           @default(now())
  studentTemplate   MessageTemplate?   @relation("StudentTemplate", fields: [studentTemplateId], references: [id])
  parentTemplate    MessageTemplate?   @relation("ParentTemplate", fields: [parentTemplateId], references: [id])
  receipts          MessageCampaignReceipt[]
}

model MessageCampaignReceipt {
  id            String             @id @default(uuid())
  campaignId    String
  studentId     String
  courseId      String?
  recipientType MessageRecipientType
  to            String
  templateId    String
  bodyvar       Json
  status        ReceiptStatus
  errorMessage  String?
  createdAt     DateTime           @default(now())
  campaign      MessageCampaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}
```

### Env
- `packages/common/src/env.ts` — add `TRUSTSIGNAL_API_KEY`, `WHATSAPP_SENDER_NUMBER`
- `apps/api/.env.example` — add both (empty); user fills `apps/api/.env`

### API (`apps/api`)
- `src/routers/admin/whatsapp.router.ts` — **new**, mounted in `admin.router.ts` at `/whatsapp`, `protect({ role: "admin" })`
- `src/controllers/admin/whatsapp.controller.ts` — **new**
- `src/services/admin/whatsapp/` — **new**:
  - `recipients.service.ts` — resolve filtered students + phones + data
  - `variable-resolver.service.ts` — field source → value
  - `whatsapp.channel.ts` — `MessageChannel` interface + Trustsignal impl
  - `campaign.service.ts` — persist campaign + receipts
  - `template-config.ts` — field-source registry per category

Endpoints:
- `GET/POST /admin/whatsapp/templates`, `PUT/DELETE /admin/whatsapp/templates/:id`
- `GET /admin/whatsapp/templates/fields?category=`
- `GET /admin/whatsapp/courses?semesterId=&departmentId=`
- `POST /admin/whatsapp/preview`  → all resolved recipients + rendered text + counts
- `POST /admin/whatsapp/send`     → send + report summary
- `GET /admin/whatsapp/campaigns`, `GET /admin/whatsapp/campaigns/:id`

`SendConfig` includes `sectionIds[]`, `scope`, template ids, `cieNumber?`,
`subjectIds?` (custom CIE subjects), `studentIds?` (custom student selection —
omitted = all), and `adHocData?` (deadline / PTM date, time, venue).

### Schemas (`packages/schemas`)
- `src/admin/whatsapp.schema.ts` — **new** (template CRUD, preview, send, campaigns)
- `src/admin/index.ts` — export it

### Web (`apps/web`)
- `modules/sidebar/sidebar-config.ts` — add admin nav item **WhatsApp** with children:
  - Templates `/admin/whatsapp/templates`
  - Send Message `/admin/whatsapp/send`
  - Send Reports `/admin/whatsapp/reports`
- `modules/admin/whatsapp/` — **new**:
  - `use-templates.ts`, `template-list-view.tsx`, `template-form.tsx` (variable builder)
  - `use-send.ts`, `send-view.tsx` (filter wizard + recipient table + preview + confirm)
  - `use-campaigns.ts`, `campaigns-view.tsx`, `campaign-detail.tsx`
- Pages:
  - `app/(protected)/admin/whatsapp/templates/page.tsx`
  - `app/(protected)/admin/whatsapp/send/page.tsx`
  - `app/(protected)/admin/whatsapp/reports/page.tsx`

Reuses `@webcampus/ui` components: `FilterBuilder`/`FilterPanel`/`FilterActions`,
`Table`, `Dialog`, `Button`, `Badge`, `Select`, `Input`, `Form`, `Tabs`, `Command`.

## Plan of Action

1. **Schema**: add Prisma models/enums to `schema.prisma` ONLY (no `db:generate`,
   no `db:migrate`). DONE — schema.prisma is updated and the build proceeded
   end-to-end without running DB commands. The user runs `db:generate` +
   `db:migrate` manually BEFORE running/verifying (types for the new models are
   only available after `db:generate`).
2. **Env**: add vars to `backendEnvSchema` + `.env.example`.
   → typecheck + lint, fix. DONE.
3. **Schemas**: create `whatsapp.schema.ts`, export from `admin/index.ts`.
   → typecheck + lint, fix. DONE.
4. **API services**: `template-config` → `variable-resolver` → `recipients` →
   `whatsapp.channel` → `campaign` persistence → `whatsapp.service` orchestrator.
   → typecheck + lint after each file, fix at that point. DONE.
5. **API controller + router**: mount `/whatsapp` in `admin.router.ts`.
   → typecheck + lint, fix. DONE.
6. **Web modules**: `multi-select`, templates module (list + form + variable
   builder), send wizard, reports module.
   → typecheck + lint after each module, fix at that point. DONE.
7. **Sidebar + pages**: add nav item and 3 page files.
   → typecheck + lint, fix. DONE.
8. **Verify**: `bun run check-types`, `bun run lint`; manual smoke test of
   templates → preview → small send → report. PENDING — user to run `db:generate`
   + `db:migrate` first, then apply their tests.

## Notes / Open Items
- No DB commands run by me at any point — only `schema.prisma` is edited. User
  runs `db:generate` + `db:migrate` manually before running/verifying. Until
  then, typecheck reports missing-Prisma-model errors on new-model usage; lint
  passes clean.
- Trustsignal response shape TBD (per-recipient status vs overall) — stored raw;
  report derives chunk-level success/failure, per-recipient rows are recorded.
- `apps/api/.env` must contain real `TRUSTSIGNAL_API_KEY` + `WHATSAPP_SENDER_NUMBER`
  before sending.
- After EVERY modification: run type check + lint and resolve at that point.
