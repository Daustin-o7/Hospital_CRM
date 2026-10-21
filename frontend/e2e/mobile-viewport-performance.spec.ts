import { test, expect } from '@playwright/test'
import * as path from 'path'

import * as fs from 'fs'

const artifactDir = process.env.ARTIFACT_DIR || path.join(process.cwd(), 'test-results')
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true })
}

test.describe('Mobile Viewport & Cross-Platform UX Performance', () => {

  test('1. iOS (iPhone 15 Pro) Viewport: Login, Safe-Area Layout, & Touch Target Validation', async ({ page }) => {
    // Emulate iPhone 15 Pro
    await page.setViewportSize({ width: 393, height: 852 })

    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Verify no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })
    expect(hasHorizontalScroll).toBe(false)

    // Touch targets check on login inputs & buttons
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    const emailBox = await emailInput.boundingBox()
    expect(emailBox?.height).toBeGreaterThanOrEqual(40)

    const doctorPreset = page.getByRole('button', { name: 'Doctor' })
    await expect(doctorPreset).toBeVisible()
    await doctorPreset.click()

    const submitBtn = page.getByRole('button', { name: /Sign in/i })
    const submitBox = await submitBtn.boundingBox()
    expect(submitBox?.height).toBeGreaterThanOrEqual(44)
    await submitBtn.click()

    // Verify dashboard navigation
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 })

    // Verify Mobile Bottom Navigation is visible
    const mobileNav = page.locator('nav[aria-label="Mobile Navigation"]')
    await expect(mobileNav).toBeVisible()

    // Verify Mobile Bottom Nav items touch targets (>= 44px)
    const homeNav = mobileNav.getByRole('link', { name: 'Home' })
    await expect(homeNav).toBeVisible()
    const homeBox = await homeNav.boundingBox()
    expect(homeBox?.height).toBeGreaterThanOrEqual(44)
    expect(homeBox?.width).toBeGreaterThanOrEqual(44)

    const menuBtn = mobileNav.getByRole('button', { name: /Menu/i })
    await expect(menuBtn).toBeVisible()
    const menuBox = await menuBtn.boundingBox()
    expect(menuBox?.height).toBeGreaterThanOrEqual(44)

    // Capture visual screenshot on iOS viewport
    const iosScreenshotPath = path.join(artifactDir, 'ios_iphone15pro_dashboard.png')
    await page.screenshot({ path: iosScreenshotPath, fullPage: false })
  })

  test('2. Android (Pixel 7) Viewport: Dashboard Layout, Navigation Drawer & POS Flow', async ({ page }) => {
    // Emulate Pixel 7
    await page.setViewportSize({ width: 412, height: 915 })

    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Pharmacist preset login
    const pharmacistPreset = page.getByRole('button', { name: 'Pharmacist' })
    await expect(pharmacistPreset).toBeVisible()
    await pharmacistPreset.click()

    await page.getByRole('button', { name: /Sign in/i }).click()
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 })

    // Verify mobile bottom navigation reflects pharmacist quick actions (POS, Batches, Compliance)
    const mobileNav = page.locator('nav[aria-label="Mobile Navigation"]')
    await expect(mobileNav).toBeVisible()

    const posLink = mobileNav.getByRole('link', { name: 'POS' })
    await expect(posLink).toBeVisible()
    const posBox = await posLink.boundingBox()
    expect(posBox?.height).toBeGreaterThanOrEqual(44)
    expect(posBox?.width).toBeGreaterThanOrEqual(44)

    // Test mobile drawer toggle
    const menuBtn = mobileNav.getByRole('button', { name: /Menu/i })
    await menuBtn.click()

    // Aside drawer should now be visible and translated in
    const drawerAside = page.locator('aside')
    await expect(drawerAside).toBeVisible()
    await expect(drawerAside.getByText('Pharmacist', { exact: true })).toBeVisible()

    // Capture visual screenshot on Android viewport with drawer open
    const androidScreenshotPath = path.join(artifactDir, 'android_pixel7_dashboard.png')
    await page.screenshot({ path: androidScreenshotPath, fullPage: false })
  })

})
