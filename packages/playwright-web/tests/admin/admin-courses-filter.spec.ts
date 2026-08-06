import { expect, test } from "@playwright/test";

test.describe("Admin courses filter - First Year department", () => {
  test("selecting an academic term exposes the semester filter", async ({
    page,
  }) => {
    await page.goto("/admin/courses");
    await page.waitForLoadState("networkidle");

    const termTrigger = page.getByRole("combobox").first();
    await termTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    await expect(page.getByRole("combobox")).toHaveCount(2);
    await expect(
      page.getByRole("main").getByText("Semester", { exact: true })
    ).toBeVisible();
  });

  test("selecting semester 1 shows cycle filter", async ({ page }) => {
    await page.goto("/admin/courses");
    await page.waitForLoadState("networkidle");

    const termTrigger = page.getByRole("combobox").first();
    await termTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    const semesterTrigger = page.getByRole("combobox").nth(1);
    await semesterTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: "/tmp/03-semester-selected.png",
      full_page: true,
    });

    const comboboxes = await page.getByRole("combobox").all();

    expect(
      comboboxes.length,
      "Expected 3 comboboxes (Term, Semester, Cycle) after selecting semester 1 or 2"
    ).toBe(3);

    const cycleTrigger = page.getByRole("combobox").nth(2);
    await cycleTrigger.click();
    await page.waitForTimeout(300);

    const cycleOptions = await page.getByRole("option").allTextContents();

    expect(cycleOptions).toContain("PHYSICS");
    expect(cycleOptions).toContain("CHEMISTRY");
    expect(cycleOptions.length).toBe(2);

    await page.screenshot({
      path: "/tmp/04-cycle-dropdown-open.png",
      full_page: true,
    });
  });
});

test.describe("Admin courses filter - Non-first-year department", () => {
  test("selecting a department after semester 3 keeps both filters", async ({
    page,
  }) => {
    await page.goto("/admin/courses");
    await page.waitForLoadState("networkidle");

    const termTrigger = page.getByRole("combobox").first();
    await termTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    const selectedTerm = await termTrigger.textContent();
    const semesterTrigger = page.getByRole("combobox").nth(1);
    await semesterTrigger.click();
    await page.waitForTimeout(300);

    const semesterOption = page
      .getByRole("option")
      .filter({ hasText: /Semester [3-9]/ })
      .first();
    await expect(semesterOption).toBeVisible();
    const selectedSemester = await semesterOption.textContent();
    await semesterOption.click();
    await page.waitForTimeout(300);

    const departmentTrigger = page.getByRole("combobox").nth(2);
    await departmentTrigger.click();
    await page.waitForTimeout(300);
    const departmentOption = page.getByRole("option").first();
    const selectedDepartment = await departmentOption.textContent();
    await departmentOption.click();
    await page.waitForTimeout(300);

    const comboboxes = page.getByRole("combobox");
    await expect(comboboxes).toHaveCount(3);
    await expect(comboboxes.nth(0)).toContainText(selectedTerm ?? "");
    await expect(comboboxes.nth(1)).toContainText(selectedSemester ?? "");
    await expect(comboboxes.nth(2)).toContainText(selectedDepartment ?? "");
    await expect(page.getByText("Cycle", { exact: true })).toHaveCount(0);
  });

  test("selecting a regular department shows semesters 3+", async ({
    page,
  }) => {
    await page.goto("/admin/courses");
    await page.waitForLoadState("networkidle");

    const termTrigger = page.getByRole("combobox").first();
    await termTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    const semesterTrigger = page.getByRole("combobox").nth(1);
    await semesterTrigger.click();
    await page.waitForTimeout(300);

    const options = await page.getByRole("option").allTextContents();
    const nonFirstYearOptions = options.filter((option) =>
      /Semester [3-9]/.test(option)
    );
    expect(nonFirstYearOptions.length).toBeGreaterThan(0);
    for (const option of nonFirstYearOptions) {
      const match = option.match(/Semester (\d+)/);
      if (match) {
        expect(parseInt(match[1], 10)).toBeGreaterThanOrEqual(3);
      }
    }

    await page.screenshot({
      path: "/tmp/05-semester-dropdown-non-firstyear.png",
      full_page: true,
    });

    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    const departmentTrigger = page.getByRole("combobox").nth(2);
    await departmentTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole("option").first().click();
    await page.waitForTimeout(300);

    const comboboxes = await page.getByRole("combobox").all();

    expect(
      comboboxes.length,
      "Expected 3 comboboxes (Term, Dept, Semester) without cycle for non-first-year"
    ).toBe(3);
  });
});
