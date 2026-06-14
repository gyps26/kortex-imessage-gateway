import { test, expect } from '@playwright/test';

test.describe('Workers page', () => {
  test('loads all three channel tabs', async ({ page }) => {
    await page.goto('/workers');
    await expect(page.getByRole('button', { name: 'iMessage' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Android SMS' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'WhatsApp' })).toBeVisible();
  });

  test('WhatsApp tab shows Add WhatsApp Line button', async ({ page }) => {
    await page.goto('/workers');
    await page.getByRole('button', { name: 'WhatsApp' }).click();
    await expect(page.getByRole('button', { name: 'Add WhatsApp Line' })).toBeVisible();
  });

  test('create WhatsApp connector opens QR modal', async ({ page }) => {
    await page.goto('/workers');
    await page.getByRole('button', { name: 'WhatsApp' }).click();
    await page.getByRole('button', { name: 'Add WhatsApp Line' }).click();

    await expect(page.getByRole('heading', { name: 'Add WhatsApp Line' })).toBeVisible();
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('heading', { name: 'Scan QR with WhatsApp' })).toBeVisible({ timeout: 10000 });
  });

  test('Edit Limit opens dialog and saves', async ({ page }) => {
    await page.goto('/workers');
    await page.getByRole('button', { name: 'WhatsApp' }).click();
    await page.getByRole('button', { name: 'Add WhatsApp Line' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Edit Limit' }).first().click();
    await expect(page.getByRole('heading', { name: 'Edit Daily Limit' })).toBeVisible();

    const input = page.locator('input[type="number"]');
    await input.fill('75');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('75').first()).toBeVisible({ timeout: 10000 });
  });

  test('Remove connector via confirm dialog', async ({ page }) => {
    await page.goto('/workers');
    await page.getByRole('button', { name: 'WhatsApp' }).click();
    await page.getByRole('button', { name: 'Add WhatsApp Line' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Remove' }).first().click();
    await expect(page.getByRole('heading', { name: 'Remove Connector' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove' }).last().click();

    await expect(page.getByText('No connectors found for WHATSAPP')).toBeVisible({ timeout: 10000 });
  });

  test('Register Android device shows setup modal', async ({ page }) => {
    await page.goto('/workers');
    await page.getByRole('button', { name: 'Android SMS' }).click();
    await page.getByRole('button', { name: 'Register Device' }).click();

    await expect(page.getByRole('heading', { name: 'Device Setup' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('img[alt="API Key QR Code"]')).toBeVisible();
  });
});

test.describe('Monitor page', () => {
  test('shows stats cards and health indicators', async ({ page }) => {
    await page.goto('/monitor');
    await expect(page.getByText('Queue Monitor')).toBeVisible();
    await expect(page.getByText('Pending')).toBeVisible();
    await expect(page.getByText('Active Connectors')).toBeVisible();
    await expect(page.getByText('Redis / BullMQ')).toBeVisible();
  });
});
