import { expect, test } from "@playwright/test";

test.describe("Support", () => {
  test("shows Raise an issue in the protected sidebar and opens the support page", async ({
    page,
  }) => {
    await page.goto("/support");

    await expect(
      page.getByRole("link", { name: "Raise an issue" })
    ).toBeVisible();
    await page.getByRole("link", { name: "Raise an issue" }).click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(
      page.getByRole("heading", { name: "Need help with something?" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Raise an issue" })
    ).toBeVisible();
  });

  test("opens the ticket creation form", async ({ page }) => {
    await page.goto("/support");
    await page.getByRole("button", { name: "Raise an issue" }).click();

    await expect(
      page.getByRole("heading", { name: "Create a new ticket" })
    ).toBeVisible();
    await expect(page.getByLabel("Subject")).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
    await expect(page.getByText("Attach files")).toBeVisible();
  });
});
