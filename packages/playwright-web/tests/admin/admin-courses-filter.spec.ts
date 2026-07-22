import { expect, test } from "@playwright/test";

test.describe("Admin courses filter - First Year department", () => {
  test("selecting Firstyear department shows only semesters 1 and 2", async ({
    page,
  }) => {
    // Navigate to admin courses page
    await page.goto("/admin/courses");
    await page.waitForLoadState("networkidle");

    // 1. Select Academic Term
    const termTrigger = page.getByRole("combobox").first();
    await termTrigger.click();
    await page.waitForTimeout(300);
    const firstTermOption = page.getByRole("option").first();
    await firstTermOption.click();
    await page.waitForTimeout(300);

    // Take screenshot after term selection
    await page.screenshot({
      path: "/tmp/01-term-selected.png",
      full_page: true,
    });

    // 2. Select Department = "Firstyear"
    const deptTrigger = page.getByRole("combobox").nth(1);
    await deptTrigger.click();
    await page.waitForTimeout(300);

    // Take screenshot to see department options
    await page.screenshot({
      path: "/tmp/02-dept-dropdown-open.png",
      full_page: true,
    });

    // Find and click "Firstyear" option
    const firstyearOption = page.getByRole("option", { name: /Firstyear/i });
    const optionExists = await firstyearOption.count();
    if (optionExists === 0) {
      // Fallback: look for text containing "First"
      const fallback = page.getByRole("option").filter({ hasText: /first/i });
      const fallbackCount = await fallback.count();
      if (fallbackCount > 0) {
        await fallback.first().click();
      } else {
        throw new Error("Could not find Firstyear department option");
      }
    } else {
      await firstyearOption.click();
    }
    await page.waitForTimeout(300);

    // Take screenshot after department selection
    await page.screenshot({
      path: "/tmp/03-dept-selected-firstyear.png",
      full_page: true,
    });

    // 3. Open Semester dropdown and verify only semesters 1 and 2 are available
    const semTrigger = page.getByRole("combobox").nth(2);
    await semTrigger.click();
    await page.waitForTimeout(300);

    // Take screenshot of semester dropdown
    await page.screenshot({
      path: "/tmp/04-semester-dropdown-open.png",
      full_page: true,
    });

    const semesterOptions = await page.getByRole("option").allTextContents();

    // Verify only semester 1 and 2 are shown (for both UG and PG)
    for (const option of semesterOptions) {
      const match = option.match(/Semester (\d+)/);
      if (match) {
        const semNum = parseInt(match[1], 10);
        expect(
          semNum,
          `Expected semester number to be 1 or 2, got: ${option}`
        ).toBeLessThanOrEqual(2);
      }
    }

    // Verify there are exactly the expected number of options
    // Odd term: UG-1, PG-1 → 2 options
    // Even term: UG-2, PG-2 → 2 options
    expect(
      semesterOptions.length,
      `Expected 2 semester options (UG+PG for sem 1 or 2), got ${semesterOptions.length}: ${semesterOptions.join(", ")}`
    ).toBe(2);

    // Close the semester dropdown
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  });

  test("selecting semester 1 shows cycle filter", async ({ page }) => {
    // Navigate to admin courses page
    await page.goto("/admin/courses");
    await page.waitForLoadState("networkidle");

    // 1. Select Academic Term
    const termTrigger = page.getByRole("combobox").first();
    await termTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    // 2. Select Department = "Firstyear"
    const deptTrigger = page.getByRole("combobox").nth(1);
    await deptTrigger.click();
    await page.waitForTimeout(300);
    const firstyearOption = page.getByRole("option", { name: /Firstyear/i });
    const optionExists = await firstyearOption.count();
    if (optionExists === 0) {
      const fallback = page.getByRole("option").filter({ hasText: /first/i });
      if ((await fallback.count()) > 0) {
        await fallback.first().click();
      }
    } else {
      await firstyearOption.click();
    }
    await page.waitForTimeout(300);

    // 3. Select first available semester (should be sem 1 or 2)
    const semTrigger = page.getByRole("combobox").nth(2);
    await semTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    // Take screenshot after semester selection
    await page.screenshot({
      path: "/tmp/05-semester-selected.png",
      full_page: true,
    });

    // 4. Verify cycle filter is now visible
    // Count comboboxes - should be 4 now (Term, Dept, Semester, Cycle)
    const comboboxes = await page.getByRole("combobox").all();

    expect(
      comboboxes.length,
      "Expected 4 comboboxes (Term, Dept, Semester, Cycle) after selecting semester 1 or 2"
    ).toBe(4);

    // Verify the cycle dropdown has PHYSICS and CHEMISTRY options
    const cycleTrigger = page.getByRole("combobox").nth(3);
    await cycleTrigger.click();
    await page.waitForTimeout(300);

    const cycleOptions = await page.getByRole("option").allTextContents();

    expect(cycleOptions).toContain("PHYSICS");
    expect(cycleOptions).toContain("CHEMISTRY");
    expect(cycleOptions.length).toBe(2);

    // Take screenshot with cycle dropdown open
    await page.screenshot({
      path: "/tmp/06-cycle-dropdown-open.png",
      full_page: true,
    });
  });
});

test.describe("Admin courses filter - Non-first-year department", () => {
  test("selecting a regular department shows semesters 3+", async ({
    page,
  }) => {
    // Navigate to admin courses page
    await page.goto("/admin/courses");
    await page.waitForLoadState("networkidle");

    // 1. Select Academic Term
    const termTrigger = page.getByRole("combobox").first();
    await termTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    // 2. Select a non-Firstyear department (e.g., Computer Science)
    const deptTrigger = page.getByRole("combobox").nth(1);
    await deptTrigger.click();
    await page.waitForTimeout(300);

    // Pick any department that is NOT Firstyear
    const options = await page.getByRole("option").allTextContents();
    const nonFirstYearOptions = options.filter(
      (o) => !/first/i.test(o) && !/service/i.test(o)
    );
    if (nonFirstYearOptions.length === 0) {
      throw new Error("No non-first-year departments found");
    }

    // Click the first non-first-year department
    await page.getByRole("option", { name: nonFirstYearOptions[0] }).click();
    await page.waitForTimeout(300);

    // Take screenshot
    await page.screenshot({
      path: "/tmp/07-non-firstyear-dept-selected.png",
      full_page: true,
    });

    // 3. Open semester dropdown and verify semesters start at 3+
    const semTrigger = page.getByRole("combobox").nth(2);
    await semTrigger.click();
    await page.waitForTimeout(300);

    const semesterOptions = await page.getByRole("option").allTextContents();

    // Verify all semesters are >= 3
    for (const option of semesterOptions) {
      const match = option.match(/Semester (\d+)/);
      if (match) {
        const semNum = parseInt(match[1], 10);
        expect(
          semNum,
          `Expected semester number >= 3, got: ${option}`
        ).toBeGreaterThanOrEqual(3);
      }
    }

    // Take screenshot
    await page.screenshot({
      path: "/tmp/08-semester-dropdown-non-firstyear.png",
      full_page: true,
    });

    // 4. Select a semester and verify cycle filter does NOT appear
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    // Should still be only 3 comboboxes (no cycle)
    const comboboxes = await page.getByRole("combobox").all();

    expect(
      comboboxes.length,
      "Expected 3 comboboxes (Term, Dept, Semester) without cycle for non-first-year"
    ).toBe(3);
  });
});
