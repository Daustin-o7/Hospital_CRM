import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Unique run number (persists across runs) → unique day offset (2..29) per run.
// Prior runs approve leaves and assign shifts on their own dates; a fresh date
// per run keeps Select/Apply conflict checks deterministic on repeated runs.
const counterFile = path.join(os.tmpdir(), 'hospital-crm-nurse-e2e-run.txt')
const runNum = (() => {
  const prev = fs.existsSync(counterFile) ? Number(fs.readFileSync(counterFile, 'utf8') || '0') : 0
  const n = (Number.isFinite(prev) ? prev : 0) + 1
  fs.writeFileSync(counterFile, String(n))
  return n
})()
const shiftDate = () => {
  const d = new Date(Date.now() + (2 + (runNum % 28)) * 86400000)
  return d.toISOString().split('T')[0]
}
const marker = `e2e-${runNum}-${Date.now()}`

async function login(page: import('@playwright/test').Page, preset: 'Admin' | 'Nurse') {
  // The dev auth endpoint allows 10 logins/min; a full-suite run can exhaust the
  // fixed window before this suite starts. Retry with a wait for the window to roll.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto('/login')
    // Preset buttons include an emoji icon — match the exact label span instead
    await page.getByText(preset, { exact: true }).click()
    await page.getByRole('button', { name: /Sign in/i }).click()
    try {
      await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
      return
    } catch (err) {
      if (attempt === 3) {
        throw new Error(`Login as ${preset} failed after ${attempt} attempts — auth rate limit (10/min) still exhausted?`)
      }
      await page.waitForTimeout(30000)
    }
  }
}

test.describe('MOD-26 Nurse roster, leave & nursing care', () => {

  // Login retry may wait out rate-limit windows — allow up to 2.5 min per test
  test.beforeEach(() => test.setTimeout(150_000))

  test('1. Admin posts an open shift on the roster', async ({ page }) => {
    await login(page, 'Admin')

    await page.getByRole('link', { name: /Nurse Roster/i }).click()
    await expect(page).toHaveURL(/.*roster/)
    await expect(page.getByRole('heading', { name: /Nurse Roster & Leave/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Pending leave requests/i })).toBeVisible()

    // Post an open shift (no nurse selected → nurses can apply)
    await page.getByRole('button', { name: /Post shift/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.locator('#shift-date').fill(shiftDate())
    await dialog.locator('#shift-type').selectOption('Evening')
    await dialog.locator('#shift-notes').fill(marker)
    await dialog.getByRole('button', { name: /^Post shift$/ }).click()
    await expect(page.getByText('Shift posted')).toBeVisible({ timeout: 8000 })

    const row = page.locator('tr', { hasText: marker })
    await expect(row).toBeVisible()
    await expect(row.getByText('Open', { exact: true })).toBeVisible()
  })

  test('2. Nurse applies, withdraws, re-applies, requests leave', async ({ page }) => {
    await login(page, 'Nurse')

    await page.getByRole('link', { name: /Nurse Roster/i }).click()
    await expect(page.getByRole('heading', { name: /Nurse Roster & Leave/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /My leave requests/i })).toBeVisible()

    const row = page.locator('tr', { hasText: marker })
    await expect(row).toBeVisible()

    // Apply → withdraw → re-apply round trip
    await row.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page.getByText(/Application sent/i)).toBeVisible({ timeout: 8000 })
    await expect(row.getByText('Applied', { exact: true })).toBeVisible()

    await row.getByRole('button', { name: 'Withdraw' }).click()
    await expect(page.getByText(/Application withdrawn/i)).toBeVisible({ timeout: 8000 })

    await row.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page.getByText(/Application sent/i)).toBeVisible({ timeout: 8000 })

    // Request leave covering the shift date (admin approves it in test 4)
    await page.getByRole('button', { name: /Request leave/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.locator('#leave-from').fill(shiftDate())
    await dialog.locator('#leave-to').fill(shiftDate())
    await dialog.getByRole('button', { name: /Submit request/i }).click()
    await expect(page.getByText('Leave request submitted')).toBeVisible({ timeout: 8000 })
  })

  test('3. Patient EHR shows the Nursing care section', async ({ page }) => {
    await login(page, 'Admin')

    await page.getByRole('link', { name: /^Patients$/i }).click()
    await expect(page).toHaveURL(/.*patients/)
    await page.locator('tbody tr').first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Nursing care')).toBeVisible({ timeout: 8000 })
    await expect(dialog.getByText('Handover notes', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Assignments', { exact: true })).toBeVisible()
  })

  test('4. Admin assigns the applicant, then approves leave with a roster-clash flag', async ({ page }) => {
    await login(page, 'Admin')
    await page.getByRole('link', { name: /Nurse Roster/i }).click()
    await expect(page.getByRole('heading', { name: /Nurse Roster & Leave/i })).toBeVisible()

    // Pick the applicant on this run's shift
    const row = page.locator('tr', { hasText: marker })
    await row.getByRole('button', { name: /Applicants \(/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Assign' }).first().click()
    await expect(page.getByText('Nurse assigned to shift')).toBeVisible({ timeout: 8000 })

    // Generous timeouts: the roster refetch can queue behind other traffic
    await expect(row.getByText('Assigned', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(row.getByText('Nurse Joy')).toBeVisible({ timeout: 10000 })

    // Approve the newest pending leave — shift is assigned on the same date,
    // so the API returns rosterConflicts and the toast flags the clash.
    await page.getByRole('button', { name: 'Approve', exact: true }).first().click()
    await expect(page.getByText(/roster shift\(s\) clash/i)).toBeVisible({ timeout: 8000 })
  })
})
