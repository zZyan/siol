import { test, expect } from '@playwright/test';

test.describe('SIOL UI Tests', () => {
  test('should load the application and display the main interface', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Check if the main title is visible
    await expect(page.getByText('SIOL', { exact: true })).toBeVisible();

    // Check if the welcome guide is visible initially (since no API key is set)
    await expect(page.getByText('Welcome to SIOL!')).toBeVisible();

    // Check if the main text area is present
    const textArea = page.getByPlaceholder('Your dictated text will appear here...');
    await expect(textArea).toBeVisible();

    // Check for the main action buttons
    // The mic button might be a generic button but we can check its container or just check there are buttons
    const buttons = page.locator('button');
    await expect(buttons).toHaveCount(6); // History, Settings, PiP, Mic, Fix, and an extra one inside PiP context perhaps or loading
  });

  test('should toggle the settings panel', async ({ page }) => {
    await page.goto('/');

    // Find the settings button (the second one in the header)
    const settingsButton = page.locator('header button').nth(1);
    await settingsButton.click();

    // Check if settings panel appears
    await expect(page.getByText('Gemini API Key', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('AIzaSy...')).toBeVisible();

    // Close settings
    await page.getByText('Done').click();
    await expect(page.getByText('Gemini API Key', { exact: true })).not.toBeVisible();
  });

  test('should switch to the history tab', async ({ page }) => {
    await page.goto('/');

    // Find the history button (the first one in the header)
    const historyButton = page.locator('header button').nth(0);
    await historyButton.click();

    // Check if history content is visible
    await expect(page.getByText('Correction History & Vocabulary')).toBeVisible();
    await expect(page.getByText('No manual corrections saved yet.')).toBeVisible();
  });
});