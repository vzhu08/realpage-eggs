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
    // The contract examples are a native disclosure: Enter opens it, then the example is a button.
    const cases = page.locator('details.finder__cases > summary');
    await cases.focus();
    await page.keyboard.press('Enter');
    const fixture = page.getByRole('button', { name: /^Decisive question/ });
    await expect(fixture).toBeEnabled();
    await fixture.focus();
    await page.keyboard.press('Enter');
    // The next step is a button that takes the keyboard to the question.
    const next = page.getByRole('button', { name: 'Go to the question' });
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: /Useful questions/ })).toBeFocused();
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
    const lookup = page.getByRole('link', { name: 'Property lookup', exact: true });
    await expect(lookup).toHaveAttribute('aria-current', 'page');
    await lookup.focus();
    await page.keyboard.press('Tab');
    const changes = page.getByRole('link', { name: 'Portfolio changes', exact: true });
    await expect(changes).toBeFocused();
    const outline = await changes.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(outline.style).toBe('solid');
    expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });

  test('evidence opens only when asked for, as a dialog that holds focus and returns it', async ({ page }) => {
    await openDemo(page);
    await openCase(page, 'Decisive question');
    // A result never opens evidence by itself, at any width.
    await expect(page.getByRole('dialog')).toHaveCount(0);
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

  test('the property chooser opens as a dialog from a selected property, holds focus and returns it', async ({ page }) => {
    await openDemo(page);
    await openCase(page, 'Decisive question');
    const opener = page.getByRole('button', { name: 'Change property' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Choose a property' });
    await expect(dialog.getByRole('searchbox', { name: 'Sample properties' })).toBeFocused();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    // Choosing another property closes the dialog and leaves the result for the new one to be run.
    await opener.click();
    await dialog.getByRole('button', { name: /1 Test Street/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: '1 Test Street, Maple Harbor, CA' })).toBeVisible();
    await expect(page.locator('.rule')).toHaveCount(0);
  });

  test('“Restart demo” returns to the start with no property, answer or result carried over', async ({ page }) => {
    await openDemo(page);
    await page.locator('[data-example="consequential_fact"]').click();
    await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
    await page.getByRole('button', { name: 'I don’t know' }).click();
    await expect(page.getByRole('region', { name: /Your answers/ })).toBeVisible();
    await page.getByRole('button', { name: 'Restart demo' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('One property.Many rules.A clearer answer.');
    await expect(page.locator('[data-example]')).toHaveCount(3);
    await expect(page.getByRole('group', { name: 'Result context' })).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe('#/lookup?mode=demo');
    // Opening the same example again starts clean.
    await page.locator('[data-example="consequential_fact"]').click();
    await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
    await expect(page.getByRole('region', { name: /Your answers/ })).toHaveCount(0);
    // From another view it also returns to the lookup start.
    await page.getByRole('link', { name: 'Portfolio changes', exact: true }).click();
    await page.getByRole('button', { name: 'Restart demo' }).click();
    await expect(page.locator('[data-example]')).toHaveCount(3);
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
