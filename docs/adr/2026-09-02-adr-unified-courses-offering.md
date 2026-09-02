# ADR: Unify Supplementary Re-offer into Courses (no Supplementary surface removal yet)

**Date:** 2026-09-02  
**Status:** Superseded by `2026-09-03-adr-supplementary-exam-cleanup.md`  
**Context:** User wants all course-related work in one place (`/admin/courses`), keep `Course Mapping` and `Sections` as separate surfaces but without duplication, and fix `SUPPLEMENTARY` filter label. `Plan mode` — no code changed.

## Decision

### 1. Re-offer existing course inside `Add Course` modal, gated by `term.type === "supplementary"`

- **Keep** `SupplementaryCourseOffering` table + `supplementary.service.ts` + `supplementary.router.ts` + `StudentPromotion` / `ReRegistrationOffering` surfaces **intact** for this cut. Do **not** delete `/admin/supplementary` or `/admin/re-registration-offering` yet (student contract `POST /student/re-registration/submit`, `POST /student/supplementary/submit` must not break mid-flight; e2e `re-registration-vertical.spec.ts:19` hits the admin offering route directly).
- Inside `Courses` (`AdminCoursesView` `apps/web/modules/admin/courses/admin-courses-view.tsx` + `AdminSemesterCourseBlock` `apps/web/modules/admin/courses/admin-semester-course-block.tsx` + `useCreateAdminCourseForm` `apps/web/modules/admin/courses/use-create-admin-course-form.tsx`), add a branch:
  - If `selectedTerm.type !== "supplementary"` → current flow: `CourseFormFields` full create (all credits, assessment, batch/pw branches) posting to `POST /admin/course` (`apps/api/src/services/admin/course.service.ts:9-12` → `CourseService.createCourse`).
  - If `selectedTerm.type === "supplementary"` → modal switches to **Add Offering** mode: Department picker + `Course (approved only)` picker (`useSupplementaryCandidateCourses` → `GET /admin/course/supplementary-candidates?departmentId&parity`) → `POST /admin/supplementary/offerings { academicTermId, courseId }` (`apps/api/src/services/admin/supplementary.service.ts:183-275`). No full `CourseFormFields` rendered.
- **Complete configuration disabled** in that mode — only the offering link is created. **Edit** remains allowed: after creation the row appears in the same table with an `Edit` action that opens the existing `Course` edit flow (which is already department-explicit and audited via `AdminCourseService.update` → `CourseService.update` with `adminContext`). That matches "admin can change/edit values".

### 2. Filter label: `SUPPLEMENTARY` → `ODD/EVEN SUPPLEMENTARY`

- Root in `getTermLabel` `packages/common/src/term-label.ts` (used everywhere: `admin-courses-view.tsx:150`, `admin-term-card.tsx:93`, `supplementary-view.tsx:196`). Today `SUPPLEMENTARY 2026` loses its parity because the label helper only prefixes parity when `type==="supplementary" && parity`. Verify `useAcademicTerms` returns `parity` for supplementary terms (`apps/api/src/services/admin/semester.service.ts:62-88,158-203`) and ensure `AdminCoursesView.courseFilterFields` maps `term.type` + `parity` → `${parity.toUpperCase()} SUPPLEMENTARY ${year}` instead of `${type.toUpperCase()} ${year}`. No new schema.

### 3. Gates — keep

- `supplementaryWindowSettledMessage` (`apps/api/src/services/admin/supplementary.service.ts:121-127,629,952`) blocking section creation/placement while window open **survives**, renamed only when a unified Offering module is introduced (`offeringWindowSettledMessage`). Faculty auto-inherit from original term (`:660-746`) also survives but lives on the Offering side, not Courses/Sections.
- `buildSupplementaryDemandRows` + `GET /terms/:id/demand` + Demand tab **retire with the SUP surface** — pattern generalizes to a per-offering-type demand view in the future unified Offering module, not in Courses.
- Sequencing invariant: if this cut does not include the unified Offering module, leave `Supplementary` module explicitly out of scope — do not half-delete it.

### 4. Courses / Course Mapping / Sections — where the seam goes

**Courses:** no change to mapping hints (`isFullyMapped` etc. at `AdminCoursesView:251-257` stays). This ADR does not touch mapping display.

**Course Mapping:** no immediate component merge. Extract a shared core into `apps/web/modules/course-mapping/` — one `CourseMappingGrid` (PC + batch branches), one shared filter/cascade state — parameterized by `scope: "admin" | "department"` that toggles only `Excel toolbar + audit dialog + URL sync + dept picker (admin)` vs `lock/super-edit banners (department)`. Pages remain thin wrappers. This eliminates twin-patching without rewriting divergence.

**Admin Sections:** replicate semantics, don't verbatim reuse Department components. Template is `AdminCourseService` → `CourseService` passthrough (`apps/api/src/services/admin/course.service.ts:33-79`).
- New `AdminSectionService` delegating to `SectionService` with explicit `departmentId + adminView:true`.
- New admin hooks `["admin-sections", ...]` + `apiPath="admin"` parallel to `useCreateAdminCourseForm` vs `useCreateCourseForm` (`admin-semester-course-block.tsx:34` vs `department/.../semester-course-block.tsx:31`).
- Divergence: Department derives `isBasicSciences`/`cycle` from session (`department-section-view.tsx:77-81`, `courses-view.tsx:49-64`); Admin derives from `selectedDepartmentId`.
- **Admin override divergence (recorded 2026-09-02 P1 verification):** `AdminSectionService.create` intentionally omits `SectionService.assertSemesterWriteAccess` / `isRestrictedUgFirstYearSemester` BASIC_SCIENCES guard (`section.service.ts:134-157, 159-198`). For admin, department-scoped first-year sections are allowed regardless of requester's home department; for department, Sem1/2 remains restricted to BASIC_SCIENCES. This is deliberate — admin authority is role-level, data scope is request-level — not a scope gap. If the policy changes, re-introduce the guard behind an `isAdmin` flag rather than silently inheriting it.

### 5. Permissions — explicit `departmentId` per request

- Keep `CreateCourseDTO { departmentId, departmentName }` (`useCreateAdminCourseForm` defaults `:36-37`) and `SectionService` scope `{ departmentId, semesterId, cycle }` explicit. No unscoped admin mode. Admin authorization is router-level (`protect({role:"admin"})`); data scope is request-level (`departmentId` in body/query). Audit via `adminContext` (`isAdmin, adminUserId, reason, ipAddress, userAgent`) stays as in `AdminCourseService.update`.

### 6. What stays standalone

- `Sections` remains a standalone route like Department (not nested inside `Courses`).
- `/admin/promotion` (`PromotionService` `apps/api/src/services/admin/promotion.service.ts:268+`) stays — student promotion domain, not course config.
- `/admin/supplementary` and `/admin/re-registration-offering` and `sidebar-config.ts` + `admin.router.ts:63-65` mounts + `re-registration-vertical.spec.ts:19` stay until the unified Offering flow replaces them. Student-facing `/student/registrations` tabs unchanged.

## Consequences

- `Courses` becomes the single entry for both "create new course" (regular terms) and "re-offer existing course" (supplementary terms) via a mode switch in the same modal — no new page, minimal navigation change.
- Supplementary terms that were `ARCHIVED` are already unblocked by `promotion@0ab3683` (Configure now enabled for all types); parity label fix will make `ODD SUPPLEMENTARY` visible in the Courses term filter.
- No breaking change to student registration contract; future Offering unification can be a separate ADR without data migration in this cut.

## Alternatives considered

- Delete `SupplementaryCourseOffering` entirely and create courses directly in supplementary semesters — rejected: loses the "re-offer approved course" guard (`approvalStatus===APPROVED`, parity check at `supplementary.service.ts:218-232`) and would duplicate course definitions per supplementary year.
- Verbatim reuse of Department section components for Admin — rejected: department-scoped controllers via `getRequestContext(req)` fail for ADMIN session without `departmentId` (`apps/api/src/services/department/section.service.ts`).

## References

- `apps/web/modules/admin/courses/admin-courses-view.tsx:144-200`
- `apps/web/modules/admin/courses/admin-semester-course-block.tsx:7,34-66`
- `packages/common/src/term-label.ts`
- `apps/api/src/services/admin/supplementary.service.ts:121-127,183-275`
- `apps/api/src/services/admin/course.service.ts:33-79`
- `apps/api/src/services/department/course.service.ts:1085-1134`
