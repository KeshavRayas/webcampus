# Implementation Summary: Fix Applicant Username Sign-In Mismatch

## Issue
After creating an applicant in the admission shell, attempting to sign in with the Application ID resulted in "Invalid username or password" error, even with the correct password.

**Root Cause:** Better Auth's username plugin normalizes usernames to lowercase during sign-in, but the backend was storing usernames in mixed/uppercase case (e.g., `APP2026001` instead of `app2026001`), causing credential lookup to fail.

## Solution
Normalize and persist auth usernames consistently to lowercase across all user creation flows, matching Better Auth's default behavior. Keep `displayUsername` for human-readable UI display.

---

## Files Modified

### 1. Backend - User Service Normalization
**File:** `apps/api/src/services/admin/user.service.ts`

**Changes:**
- Added `normalizeUsername()` static method that trims and lowercases usernames
- Updated `getDefaultUsername()` to use the normalizer
- Modified `ensureUserProfileFields()` to normalize any provided username before persisting

**Impact:** All users created through UserService (applicants, students, etc.) will have normalized lowercase usernames for auth credential lookup.

```typescript
private static normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
```

---

### 2. Backend - Admission Service Integration
**File:** `apps/api/src/services/admission/admission.service.ts`

**Changes:**
- In `createShell()`: Changed `username: applicationId` to `username: AdmissionService.normalizeApplicationId(applicationId)`
- In `resolveApplicantUsersForPort()`: Updated username creation to use normalized `applicationId`
- Added documentation explaining the lowercase normalization for Better Auth compatibility

**Impact:** Admission shell creation and student porting flows will create applicant users with normalized usernames.

Before:
```typescript
username: applicationId  // e.g., "APP2026001"
```

After:
```typescript
username: AdmissionService.normalizeApplicationId(applicationId)  // e.g., "app2026001"
```

---

### 3. Frontend - Defensive Sign-In Form Normalization
**File:** `apps/web/modules/auth/sign-in/username/use-username-sign-in-form.tsx`

**Changes:**
- Modified `onSubmit()` handler to normalize username input before submission
- Added trim().toLowerCase() to handle user-input variations (spaces, case)

**Impact:** Sign-in form accepts Application ID in any case and normalizes it client-side before sending to backend.

Before:
```typescript
await authClient.signIn.username(data, { ... })
```

After:
```typescript
const normalizedData = {
  ...data,
  username: data.username.trim().toLowerCase(),
};
await authClient.signIn.username(normalizedData, { ... })
```

---

### 4. Data Migration Script
**File:** `apps/api/scripts/backfill-applicant-usernames.ts` (NEW)

**Purpose:** Normalize existing applicant users who may have uppercase/mixed-case usernames from before this fix.

**Features:**
- Finds all applicant users with non-lowercase usernames
- Provides `--dry-run` option to preview changes without persisting
- Logs affected users and progress
- Handles errors gracefully

**Usage:**
```bash
# Preview changes
bunx tsx apps/api/scripts/backfill-applicant-usernames.ts --dry-run

# Apply changes
bunx tsx apps/api/scripts/backfill-applicant-usernames.ts
```

---

### 5. Test Coverage
**File:** `apps/api/src/__tests__/services/admission/username-normalization.test.ts` (NEW)

**Test Cases:**
1. Applicant creation with uppercase username stores normalized lowercase
2. displayUsername preserved separately from credential username
3. Missing username in request derives and normalizes from email
4. AdmissionService normalizeApplicationId utility behavior

**Impact:** Regression coverage for username normalization across creation flows.

---

## Verification Steps

### 1. Manual Testing
```
✅ Create admission shell with Application ID "APP2026002"
✅ Verify stored user.username = "app2026002"
✅ Verify user.displayUsername preserved (e.g., "Applicant APP2026002")
✅ Sign in with Application ID in any case + password "password"
✅ Expect successful session creation
```

### 2. Run Backfill Script (Optional)
For existing applicants with uppercase usernames:
```bash
bunx tsx apps/api/scripts/backfill-applicant-usernames.ts --dry-run
bunx tsx apps/api/scripts/backfill-applicant-usernames.ts
```

### 3. Compile Check (PASSED ✅)
- TypeScript compilation: **NO ERRORS**
- ESLint check on modified files: **PASSED**

### 4. Test Execution
```bash
# Run new test suite
bun test src/__tests__/services/admission/username-normalization.test.ts
```

---

## Affected User Roles

- **Applicants**: Primary beneficiaries. Sign-in now works after admission shell creation.
- **Students**: Improved consistency. Backend normalization applies to student users created via UserService.

**Note:** The fix uses the existing `normalizeApplicationId()` method that was already in the codebase for queries, ensuring consistency across the system.

---

## Architecture Decision

**Why Lowercase?**

Better Auth's username plugin has default behavior:
- Sign-up: Accepts any casing, stores normalized (lowercase)
- Sign-in: Normalizes input to lowercase before lookup
- Verification: Uses database with mode: "insensitive" for case-insensitive queries

By storing usernames in lowercase, we align with Better Auth's expectations and avoid the mismatch that caused the sign-in failure.

**displayUsername vs username:**
- `username`: Credential for auth (always lowercase, never displayed)
- `displayUsername`: UI display field (preserves user-friendly casing)

---

## Files at a Glance

| File | Type | Change |
|------|------|--------|
| `apps/api/src/services/admin/user.service.ts` | Modified | Added normalizeUsername() and updated profile hydration |
| `apps/api/src/services/admission/admission.service.ts` | Modified | Apply normalization in createShell and port flows |
| `apps/web/modules/auth/sign-in/username/use-username-sign-in-form.tsx` | Modified | Client-side defensive normalization |
| `apps/api/scripts/backfill-applicant-usernames.ts` | New | Migration script for existing records |
| `apps/api/src/__tests__/services/admission/username-normalization.test.ts` | New | Regression test coverage |

---

## Next Steps (Optional)

1. **Run Backfill Script** (if there are existing applicants with uppercase usernames)
   ```bash
   bunx tsx apps/api/scripts/backfill-applicant-usernames.ts --dry-run
   ```

2. **Deploy Changes:**
   - Rebuild and redeploy `apps/api` 
   - Rebuild and redeploy `apps/web`

3. **Test End-to-End:**
   - Create new admission shell
   - Attempt sign-in with Application ID (any case)
   - Verify successful login

4. **Monitor Logs:**
   - Check auth logs for any sign-in anomalies post-deployment

---

## Rollback Plan

If issues arise, revert commits to the three modified files. The changes are isolated and backward-compatible (existing data structures unchanged, only applied at query/storage time).

---

**Status: ✅ IMPLEMENTATION COMPLETE**

All changes have been implemented, type-checked, and are ready for testing and deployment.
