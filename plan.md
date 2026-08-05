# WebCampus Feedback Feature - Implementation Plan

Status summary of the student course-feedback feature build. "Done" = implemented and passing; "TODO" = remaining work.

## Objective

Build a student course-feedback feature:
- Admin-configured question sets + feedback rounds, per academic term.
- Students submit one feedback per registered CourseAssignment (theory/lab separate).
- Role-scoped reports: Faculty (own data), HOD (own department), Admin (all).
- Term-level configuration: one reusable question preset per academic term (ODD 2026, EVEN 2026, ...), three rounds per term.

## Constraints / Notes

- User applies all Prisma migrations manually; migrations must NOT be applied by tooling.
- Feedback is per registered `CourseAssignment` (logical theory/lab separation, separate submissions).
- One set of ten questions per academic term; admin reuses a question preset for the whole term.
- Three feedback rounds per term; admin sets enable/disable and dates.
- Students cannot edit/resubmit; duplicate submissions blocked by DB unique index.
- Reports show question averages, average score out of 5, percentage `(avg/5)*100`, response counts; CSV export uses applied report filters.
- Faculty sees only own assignments; HOD only own department; admin sees all (enforced in backend, not just UI).
- Student can access a course only if registered for it AND assigned to that CourseAssignment.
- Admin config UI lives under existing sidebar "Academic/Academics" group. Student/faculty/etc. feedback nested under existing Academics sections.
- Do NOT change existing assignment/registration/response/report data — only configuration and answers.
- Commands to verify: `bun run check-types`, `bun run lint`, feedback tests, `bun run build` (without applying migration).

## DONE

- **DB schema** (`packages/db/prisma/schema.prisma`):
  - `FeedbackQuestionSet`, `FeedbackQuestion`, `FeedbackRound`, `FeedbackResponse`, `FeedbackAnswer`.
  - `FeedbackQuestionPreset`, `FeedbackQuestionPresetItem`.
  - Term-level: `FeedbackQuestionSet.semesterId` nullable + `presetId`, `FeedbackRound.semesterId?`, `@@unique([academicTermId, roundNumber])`.
- **Migration files (NOT applied)**:
  - `packages/db/prisma/migrations/20260805120000_add_feedback/` — base feedback tables (created to fill the missing base migration).
  - `packages/db/prisma/migrations/20260805130000_add_feedback_question_presets/` — preset tables + `presetId` column; FK table name corrected (`"academicTerm"` -> `"AcademicTerm"`).
- **Validation schemas** (`packages/schemas/src/feedback/feedback.schema.ts`): submission, question set, round, report, preset, `FeedbackTermConfigurationSchema` + `FeedbackTermConfigurationInput`.
- **RBAC** (`packages/auth/src/rbac/permissions.ts`): `feedback: ["create","read","manage","export"]` with per-role assignments; student gets both `read` and `create`.
- **API routes**: wired in `app.ts`, `routers/student/feedback.router.ts`, `routers/feedback.router.ts`.
  - Admin term config: `GET /admin/feedback/configuration/term/:academicTermId`, `POST /admin/feedback/configuration/term`.
  - Removed superseded semester-based `GET /configuration/:semesterId` and `POST /questions`.
- **Controllers + services**: `controllers/feedback.controller.ts`, `services/shared/feedback.service.ts`, `services/shared/feedback-scope.service.ts`.
  - `configureTerm(userId, { academicTermId, presetId })` copies the preset's 10 questions into the term question set; locked once rounds exist or `isLocked`.
  - `getTermConfiguration(academicTermId)` returns question set (preset + questions) + rounds.
  - Rounds created per term (`academicTermId_roundNumber`), round N requires round N-1.
- **Role scoping** resolver (`resolveFeedbackScope`) in `feedback-scope.service.ts`.
- **Student feedback UI**: `apps/web/app/(protected)/feedback/page.tsx` + `modules/feedback/feedback-view.tsx`.
- **Report views + CSV export**: `modules/feedback/feedback-report-view.tsx`, memory-safe CSV builder in `feedback-api.ts`.
- **Admin feedback config**: `apps/web/app/(protected)/admin/feedback/page.tsx` -> `modules/feedback/feedback-config-view.tsx` (term-level rewrite); **presets** at `/admin/feedback/presets` (`modules/feedback/feedback-presets-view.tsx`).
- **Sidebar** updated in `modules/sidebar/sidebar-config.ts` (Admin Academic -> Feedback -> Question Presets / Configure Feedback / Feedback Reports; student/faculty/HOD/etc. nested under their Academics tabs).
- **Bug fixes applied**: student 403; report invalid-UUID validation; apply-filters-before-report workflow.
- **Verification (current)**: `bun run check-types` passes (all 9 packages), `bun run lint` passes, feedback service tests pass (3).

## NOT DONE / REMAINING

- **Production build check**: `bun run build` not yet re-run after the term-level changes.
- **Migration NOT applied** — user applies `20260805120000_add_feedback` then `20260805130000_add_feedback_question_presets` manually. (Dev DB already has the term-level tables from the squashed baseline.)
- Optional: keep an eye on `FeedbackQuestionSetSchema`/`saveQuestionSet`-style remnants if a semester-based path is still desired anywhere (currently removed from router/controller/service).

## Next Steps

1. Run `bun run build` to confirm the production build still passes.
2. User applies the two migration files manually.
3. Smoke-test term config UI flow in the browser (create preset -> configure term -> set rounds -> enable).

## Relevant Files

- `packages/db/prisma/schema.prisma` — feedback + term-level models
- `packages/db/prisma/migrations/20260805120000_add_feedback/migration.sql` — base feedback tables
- `packages/db/prisma/migrations/20260805130000_add_feedback_question_presets/migration.sql` — presets + `presetId`
- `packages/schemas/src/feedback/feedback.schema.ts` — term-level schemas, `FeedbackTermConfigurationSchema`
- `apps/api/src/services/shared/feedback.service.ts` — term config + preset CRUD; submission/report aggregation
- `apps/api/src/controllers/feedback.controller.ts` — term config, presets, rounds, reports, role scope
- `apps/api/src/routers/feedback.router.ts` — admin term/preset/round/report router + role-scoped report router
- `apps/api/src/services/shared/feedback-scope.service.ts` — role resolver (faculty, hod, department, coe, admin)
- `apps/web/modules/feedback/feedback-config-view.tsx` — admin term config view (rewritten for term + preset)
- `apps/web/modules/feedback/feedback-presets-view.tsx` — question-preset admin UI
- `apps/web/modules/feedback/feedback-report-view.tsx` — filtered apply-first report tables + CSV
- `apps/web/modules/feedback/feedback-api.ts` — frontend API client for report/presets
- `apps/web/modules/sidebar/sidebar-config.ts` — feedback UI under existing Academics entries
