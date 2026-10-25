import { test, expect } from '@playwright/test';

test.describe('ERP Démo — Parcours transverse (DEMO-SCENARIO.md)', () => {
  test('charge l’application, affiche les 5 horizons et permet d’exécuter le scénario démo', async ({ page }) => {
    await page.goto('/');

    // 1. Vue d'ensemble
    await expect(page.locator('h1')).toContainText('Vue d’ensemble');
    await expect(page.getByText('Millésime 2023')).toBeVisible();
    await expect(page.getByText('Horizon 2027')).toBeVisible();

    // Basculer en rôle Direction pour le parcours transverse multi-métier
    await page.getByLabel('Rôle prévisualisé').selectOption('direction');

    // 2. Ouvrir le Scénario Démo guidé
    await page.getByRole('button', { name: /Scénario Démo/i }).click();
    await expect(page.getByText('Visite guidée du scénario de démo')).toBeVisible();

    // 3. Étape 6 : Réaliser l'assemblage 2025
    for (let i = 1; i < 6; i++) {
      await page.getByRole('button', { name: /Étape suivante/i }).click();
    }
    await expect(page.getByText('6. Assemblage 2025')).toBeVisible();
    await page.getByRole('button', { name: /Exécuter l’assemblage 2025/i }).click();

    // 4. Étape 7 : Mise en bouteilles
    await page.getByRole('button', { name: /Étape suivante/i }).click();
    await expect(page.getByText('7. Mise en bouteilles')).toBeVisible();
    await page.getByRole('button', { name: /Exécuter la mise de 660 bouteilles/i }).click();

    // 5. Étape 8 : Vente & Livraison
    await page.getByRole('button', { name: /Étape suivante/i }).click();
    await expect(page.getByText('8. Vente, Réservation & Expédition')).toBeVisible();
    await page.getByRole('button', { name: /Commander 120 & livrer 72/i }).click();

    // 6. Étape 9 : Facture démo & Règlement
    await page.getByRole('button', { name: /Étape suivante/i }).click();
    await expect(page.getByText('9. Facture démo')).toBeVisible();
    await page.getByRole('button', { name: /Émettre facture & paiement/i }).click();

    // 7. Étape 10 : Traçabilité
    await page.getByRole('button', { name: /Étape suivante/i }).click();
    await expect(page.getByText('10. Traçabilité complète')).toBeVisible();
    await page.getByRole('button', { name: /Fermer/i }).click();

    // Vérifier les stocks dans l'onglet Conditionnement
    await page.getByRole('button', { name: /Conditionnement & Stocks/i }).click();
    await expect(page.getByText('588')).toBeVisible(); // 660 - 72 shipped
    await expect(page.getByText('48')).toBeVisible(); // 120 - 72 residual reserved
    await expect(page.getByText('540')).toBeVisible(); // 588 - 48 available
  });

  test('vérifie la réactivité et l’absence de débordement horizontal sur mobile (390x844 et 320px)', async ({ page }) => {
    // Test sur format mobile standard (390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('Vue d’ensemble');

    // Vérifier pas de débordement horizontal global
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Tester navigation mobile
    await page.getByRole('button', { name: /Chai & Vinification/i }).click();
    await expect(page.getByText('Occupation des contenants')).toBeVisible();

    // Tester sur écran très étroit (320px)
    await page.setViewportSize({ width: 320, height: 600 });
    const hasHorizontalScroll320 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll320).toBe(false);
  });
});
