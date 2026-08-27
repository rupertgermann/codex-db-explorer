import { expect, test } from "@playwright/test";

test("previews, applies, and manually rechecks one visible Summary Memory", async ({ page }) => {
  const invalid = await page.request.post("/api/memory/forget", { data: { action: "apply", plan: {} } });
  expect(invalid.status()).toBe(400);
  await expect(invalid.json()).resolves.toEqual({ error: "A valid confirmed Forget plan is required." });

  await page.goto("/");
  await page.getByRole("button", { name: "Markdown memory" }).click();
  await page.getByRole("button", { name: /memory_summary\.md/ }).click();
  await page.getByRole("button", { name: "Preview" }).click();

  await page.getByRole("button", { name: "Forget…" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Forget this Memory?" });
  await expect(dialog.getByText("Confirm the durable sources")).toBeVisible();
  await dialog.getByRole("button", { name: "Update plan" }).click();
  await expect(dialog.getByText("Exact affected sections (5)")).toBeVisible();
  await dialog.getByRole("button", { name: "Apply Forget plan" }).click();

  await expect(dialog.getByText("Memory removed and verified; delete tombstone written.")).toBeVisible();
  await expect(dialog.getByText("memory_summary.md", { exact: true }).last()).toBeVisible();
  await dialog.getByRole("button", { name: "Recheck now" }).click();
  await expect(dialog.getByText("No positive copy currently appears in the Memory corpus.")).toBeVisible();
});
