import { test, expect } from '@playwright/test'

test.describe('Hospital_CRM Full E2E Test Suite', () => {

  test('1. Authentication: Login with Doctor and Verify Navigation', async ({ page }) => {
    await page.goto('/login')

    // Check dev preset button for Doctor
    const doctorPreset = page.getByRole('button', { name: 'Doctor' })
    await expect(doctorPreset).toBeVisible()
    await doctorPreset.click()

    // Sign in
    await page.getByRole('button', { name: /Sign in/i }).click()

    // Should navigate to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 12000 })
    await expect(page.getByText('Healthcare OS')).toBeVisible()
    await expect(page.locator('aside').getByText('Doctor', { exact: true })).toBeVisible()
  })

  test('2. Authentication: Login with Pharmacist and Role Verification', async ({ page }) => {
    await page.goto('/login')

    const pharmacistPreset = page.getByRole('button', { name: 'Pharmacist' })
    await expect(pharmacistPreset).toBeVisible()
    await pharmacistPreset.click()

    await page.getByRole('button', { name: /Sign in/i }).click()

    await expect(page).toHaveURL(/.*dashboard/)
    await expect(page.locator('aside').getByText('Pharmacist', { exact: true })).toBeVisible()

    // Pharmacist should have access to Pharmacy POS, Drug Batches, and Drug Compliance
    await expect(page.getByRole('link', { name: /Pharmacy POS/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Drug Batches/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Drug Compliance/i })).toBeVisible()
  })

  test('3. Pharmacy POS: Real-Time Drug Search & FEFO Fast Checkout', async ({ page }) => {
    // Login as Pharmacist
    await page.goto('/login')
    await page.getByRole('button', { name: 'Pharmacist' }).click()
    await page.getByRole('button', { name: /Sign in/i }).click()
    await expect(page).toHaveURL(/.*dashboard/)

    // Navigate to Pharmacy POS
    await page.getByRole('link', { name: /Pharmacy POS/i }).click()
    await expect(page).toHaveURL(/.*pharmacy\/pos/)
    await expect(page.getByRole('heading', { name: /Pharmacy Counter POS/i })).toBeVisible()

    // Search for Paracetamol / Dolo
    const searchInput = page.locator('input[placeholder*="Augmentin"]')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('Paracetamol')

    // Wait for live search results
    await expect(page.getByText(/Paracetamol 650mg/i)).toBeVisible({ timeout: 5000 })

    // Add Paracetamol 650mg to Cart
    const addBtn = page.getByRole('button', { name: '+ Add' }).first()
    await addBtn.click()

    // Verify item in cart
    await expect(page.getByText(/Current Order Cart/i)).toBeVisible()
    await expect(page.getByText(/1 items/i)).toBeVisible()

    // Enter customer details
    await page.getByPlaceholder('e.g. Ramesh Kumar').fill('Test Walkin Customer')
    await page.getByPlaceholder('+91 98765 43210').fill('+91 99999 11111')

    // Complete checkout
    const completeSaleBtn = page.getByRole('button', { name: /Complete Sale/i })
    await completeSaleBtn.click()

    // Verify receipt modal appears
    await expect(page.getByText('Sale Completed')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('SAMSTACK HEALTHCARE PHARMACY')).toBeVisible()
    await expect(page.getByText('Tax Invoice / Cash Receipt')).toBeVisible()

    // Close modal
    await page.getByRole('button', { name: 'New Transaction' }).click()
    await expect(page.getByText('Sale Completed')).not.toBeVisible()
  })

  test('4. Pharmacy Compliance: Schedule H1 Mandatory Prescriber Gate', async ({ page }) => {
    // Login as Pharmacist
    await page.goto('/login')
    await page.getByRole('button', { name: 'Pharmacist' }).click()
    await page.getByRole('button', { name: /Sign in/i }).click()

    // Navigate to Pharmacy POS
    await page.getByRole('link', { name: /Pharmacy POS/i }).click()

    // Search for Augmentin 625 (Schedule H1 Antibiotic)
    const searchInput = page.locator('input[placeholder*="Augmentin"]')
    await searchInput.fill('Augmentin')

    await expect(page.getByText(/Augmentin 625 Duo/i)).toBeVisible({ timeout: 5000 })

    // Add to Cart
    await page.getByRole('button', { name: '+ Add' }).first().click()

    // Verify Schedule H1 badge and form
    await expect(page.getByText('⚠️ Schedule H1 Contained')).toBeVisible()
    await expect(page.getByText('Prescribing Doctor *')).toBeVisible()
    await expect(page.getByText('Doctor Reg # *')).toBeVisible()

    // Try checkout without prescriber details -> should show error
    await page.getByRole('button', { name: /Complete Sale/i }).click()
    await expect(page.getByText(/Schedule H1 \/ NDPS medicines legally require/i)).toBeVisible()

    // Fill in required statutory details
    await page.getByPlaceholder('e.g. Ramesh Kumar').fill('Patient Ankit Verma')
    await page.getByPlaceholder('Dr. S. Sharma').fill('Dr. V. K. Malhotra')
    await page.getByPlaceholder('MCI-12345/2018').fill('MCI-98432/2015')

    // Now complete sale
    await page.getByRole('button', { name: /Complete Sale/i }).click()
    await expect(page.getByText('Sale Completed')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'New Transaction' }).click()

    // Navigate to Statutory Register to verify compliance log
    await page.getByRole('link', { name: /Drug Compliance/i }).click()
    await expect(page).toHaveURL(/.*pharmacy\/compliance/)
    await expect(page.getByText(/Controlled Substance & Schedule H1 Register/i)).toBeVisible()

    // Verify the record is in the table
    await expect(page.getByText(/Amoxicillin \+ Clavulanate/i).first()).toBeVisible()
    await expect(page.getByText('Patient Ankit Verma').first()).toBeVisible()
    await expect(page.getByText('Dr. V. K. Malhotra').first()).toBeVisible()
    await expect(page.getByText('MCI-98432/2015').first()).toBeVisible()
  })

  test('5. Drug Master & Stock Inwarding (GRN)', async ({ page }) => {
    // Login as Pharmacist
    await page.goto('/login')
    await page.getByRole('button', { name: 'Pharmacist' }).click()
    await page.getByRole('button', { name: /Sign in/i }).click()

    // Navigate to Drug Batches
    await page.getByRole('link', { name: /Drug Batches/i }).click()
    await expect(page).toHaveURL(/.*pharmacy\/batches/)
    await expect(page.getByText(/Medicine Catalog & Stock/i)).toBeVisible()

    // Check formulations count and table
    await expect(page.getByText('Total Formulations')).toBeVisible()
    await expect(page.getByText('Paracetamol 500mg')).toBeVisible()

    // Open Inward Stock Modal for first drug
    const inwardBtn = page.getByRole('button', { name: '+ Inward Stock' }).first()
    await inwardBtn.click()

    await expect(page.getByText('Inward Medicine Stock (GRN)')).toBeVisible()

    // Fill new batch form
    await page.getByPlaceholder('e.g. BAT-2026-09').fill('BAT-TEST-999')
    await page.locator('input[type="date"]').first().fill('2028-12-31') // Expiry
    await page.getByPlaceholder('100').fill('250')
    await page.getByPlaceholder('120.00').fill('150.00')

    await page.getByRole('button', { name: 'Save Batch Stock' }).click()

    // Modal closes and new stock reflects
    await expect(page.getByText('Inward Medicine Stock (GRN)')).not.toBeVisible({ timeout: 5000 })
  })

  test('6. Patient Registry: DPDP-Compliant Registration & Search', async ({ page }) => {
    // Login as Receptionist
    await page.goto('/login')
    await page.getByRole('button', { name: 'Reception' }).click()
    await page.getByRole('button', { name: /Sign in/i }).click()

    // Navigate to Patients
    await page.getByRole('link', { name: /Patients/i }).click()
    await expect(page).toHaveURL(/.*patients/)
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible()

    // Open Register Modal
    await page.locator('#register-patient-btn').click()
    await expect(page.getByText('Register new patient')).toBeVisible()

    const uniqueName = `Pooja Sharma ${Date.now().toString().slice(-4)}`
    const uniquePhone = `+91 98${Math.floor(10000000 + Math.random() * 89999999)}`
    await page.locator('#reg-name').fill(uniqueName)
    await page.locator('#reg-phone').fill(uniquePhone)
    await page.locator('#reg-gender').selectOption('Female')
    await page.locator('#reg-age').fill('28')
    await page.locator('#reg-address').fill('12 Green Park, New Delhi')
    await page.locator('#reg-consent').check()

    // Submit form
    await page.locator('#submit-patient-btn').click()
    await expect(page.getByRole('heading', { name: 'Register new patient' })).not.toBeVisible({ timeout: 5000 })

    // Verify patient in list / search
    await page.locator('#patient-search').fill(uniqueName)
    await expect(page.getByText(uniqueName).first()).toBeVisible({ timeout: 5000 })
  })

  test('7. Appointments & Doctor Schedule: Appointment Booking', async ({ page }) => {
    // Login as Doctor
    await page.goto('/login')
    await page.getByRole('button', { name: 'Doctor' }).click()
    await page.getByRole('button', { name: /Sign in/i }).click()

    // Navigate to Appointments
    await page.getByRole('link', { name: /Appointments/i }).click()
    await expect(page).toHaveURL(/.*appointments/)
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible()

    // Open Book Appointment Modal
    await page.locator('#book-appointment-btn').click()
    await expect(page.getByRole('heading', { name: 'Book appointment' })).toBeVisible()

    // Wait for dropdown options to populate
    await expect(page.locator('#appt-patient option').nth(1)).toBeAttached({ timeout: 8000 })
    await expect(page.locator('#appt-doctor option').nth(1)).toBeAttached({ timeout: 8000 })

    // Select first patient and first doctor
    await page.locator('#appt-patient').selectOption({ index: 1 })
    await page.locator('#appt-doctor').selectOption({ index: 1 })
    const targetDate = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
    await page.locator('#appt-date-input').fill(targetDate)
    const randomHour = 10 + Math.floor(Math.random() * 2)
    const randomMin = (Math.floor(Math.random() * 11) * 5).toString().padStart(2, '0')
    await page.locator('#appt-time').fill(`${randomHour.toString().padStart(2, '0')}:${randomMin}`)

    await page.locator('#submit-appt-btn').click()
    await expect(page.getByRole('heading', { name: 'Book appointment' })).not.toBeVisible({ timeout: 5000 })
  })

  test('8. Generic Medicine Substitution: Bio-Equivalent Matching', async ({ page }) => {
    // Login as Pharmacist
    await page.goto('/login')
    await page.getByRole('button', { name: 'Pharmacist' }).click()
    await page.getByRole('button', { name: /Sign in/i }).click()

    // Navigate to Pharmacy POS
    await page.getByRole('link', { name: /Pharmacy POS/i }).click()
    await expect(page).toHaveURL(/.*pharmacy\/pos/)

    // Search for Paracetamol to test generic alternatives
    const searchInput = page.locator('input[placeholder*="Augmentin"]')
    await searchInput.fill('Paracetamol')
    await expect(page.getByText(/Paracetamol 650mg/i)).toBeVisible({ timeout: 5000 })

    // Click Substitutes button
    const genericBtn = page.getByRole('button', { name: 'Substitutes' }).first()
    await genericBtn.click()
    await expect(page.getByText(/Generic Molecule Substitutes/i)).toBeVisible()
  })

})

