import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, openCase, openDemo, openEvidence } from './helpers';

test.describe('keyboard, focus and layout', () => {
  test('skip link is the first stop and moves focus to the content', async ({ page }) => {
    await openDemo(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('the whole journey works from the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Hardware keyboard flow is exercised at desktop width');
    await openDemo(page);
    const fixture = page.getByRole('button', { name: /^Decisive question/ });
    await expect(fixture).toBeEnabled();
    await fixture.focus();
    await page.keyboard.press('Enter');
    const input = page.getByRole('textbox', { name: "What is the property's units?" });
    await input.focus();
    await page.keyboard.type('8');
    await page.keyboard.press('Enter');
    // Focus follows the outcome of the answer.
    await expect(page.getByRole('heading', { name: 'Re-evaluated with your answers' })).toBeFocused();

    // Evidence tabs: arrow keys move between views, Home/End jump.
    const panel = await openEvidence(page);
    await panel.getByRole('tab', { name: /Source text/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(panel.getByRole('tab', { name: 'Encoded rule' })).toBeFocused();
    await expect(panel.getByRole('tab', { name: 'Encoded rule' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('tabpanel')).toContainText('The rule is encoded as');
    await page.keyboard.press('End');
    await expect(panel.getByRole('tab', { name: /Versions/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(panel.getByRole('tab', { name: /Source text/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('focus is visible on interactive controls', async ({ page }) => {
    await openDemo(page);
    const lookup = page.getByRole('link', { name: 'Lookup', exact: true });
    await lookup.focus();
    await page.keyboard.press('Tab');
    const outline = await page.getByRole('link', { name: 'Changes', exact: true }).evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(outline.style).toBe('solid');
    expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });

  test('on a narrow screen, evidence opens as a dialog that holds focus and returns it', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'The modal presentation is used below 1280px; verified on the mobile project');
    await openDemo(page);
    await openCase(page, 'Decisive question');
    const opener = page.getByRole('button', { name: /Inspect evidence for/ });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Synthetic Maple Harbor deposit cap' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(dialog).toContainText('Beginning November 15, 2026');
    // Tab never leaves the dialog.
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('landmarks, one h1, labeled controls and no sideways scroll', async ({ page }) => {
    await openDemo(page);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Views' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);

    await openCase(page, 'Two unresolved exemptions');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const unlabeled = await page.evaluate(() =>
      [...document.querySelectorAll('input, select, textarea, button')].filter((element) => {
        const control = element as HTMLInputElement;
        const named = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby') || (element.tagName === 'BUTTON' && element.textContent?.trim());
        return !named;
      }).length,
    );
    expect(unlabeled).toBe(0);
    await expectNoHorizontalOverflow(page);

    await page.goto('/#/changes?mode=demo');
    await page.getByRole('button', { name: 'Oct 1, 2026 → Nov 15, 2026', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Comparison result' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });

  test('the disclaimer and the data-source choice are always on screen', async ({ page }) => {
    await openDemo(page);
    await expect(page.getByRole('banner')).toContainText('Not legal advice. Coverage is not a finding of compliance or a violation.');
    await expect(page.getByRole('radio', { name: 'Synthetic demo' })).toBeChecked();
    await page.goto('/#/changes?mode=demo');
    await expect(page.getByRole('banner')).toContainText('Not legal advice.');
    await expect(page.getByRole('note', { name: 'Synthetic demo notice' })).toBeVisible();
  });
});
