import { z } from 'zod'

// Universal regex patterns
export const PHONE_REGEX = /^[6-9]\d{9}$/
export const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
export const HSN_REGEX = /^\d{4,8}$/
export const IDEMP_PAT_REGEX = /^IDEMP-PAT-[a-zA-Z0-9-]+$/
export const IDEMP_INV_REGEX = /^IDEMP-INV-[a-zA-Z0-9-]+$/
export const IDEMP_PAY_REGEX = /^IDEMP-PAY-[a-zA-Z0-9-]+$/

// ── Patient Schemas ────────────────────────────────────────────────────────
export const patientRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
  phone: z.string().trim().regex(PHONE_REGEX, 'Must be a valid 10-digit mobile number (starting with 6-9)'),
  dob: z.string().optional().refine(d => !d || new Date(d) <= new Date(), {
    message: 'Date of birth cannot be in the future',
  }),
  approxAge: z.coerce.number().int().min(0, 'Age cannot be negative').max(130, 'Age cannot exceed 130').optional().nullable(),
  gender: z.enum(['Male', 'Female', 'Other', 'PreferNotToSay'], {
    message: 'Please select a valid gender',
  }),
  address: z.string().trim().max(500, 'Address cannot exceed 500 characters').optional().or(z.literal('')),
  consentAccepted: z.literal(true, {
    message: 'Patient consent is mandatory for registration',
  }),
  consentPurpose: z.string().trim().max(200, 'Purpose cannot exceed 200 characters').optional().or(z.literal('')),
}).refine(data => !!data.dob || (data.approxAge !== null && data.approxAge !== undefined), {
  message: 'Either Date of Birth or Approximate Age is required',
  path: ['dob'],
})

export type PatientRegisterFormData = z.infer<typeof patientRegisterSchema>

// ── Appointment Schemas ───────────────────────────────────────────────────
export const appointmentBookingSchema = z.object({
  patientId: z.string().uuid('Please select a valid registered patient'),
  doctorId: z.string().uuid('Please select a valid doctor'),
  date: z.string().regex(ISO_DATE_REGEX, 'Date must be in YYYY-MM-DD format').refine(d => {
    const today = new Date().toISOString().split('T')[0]
    return d >= today
  }, { message: 'Appointment date cannot be in the past' }),
  timeSlot: z.string().regex(TIME_HH_MM_REGEX, 'Time slot must be in HH:mm format (e.g. 10:30)'),
  type: z.enum(['scheduled', 'walkin'], {
    message: 'Please select an appointment type',
  }),
  priority: z.enum(['Normal', 'Urgent', 'Emergency'], {
    message: 'Please select a priority level',
  }),
})

export type AppointmentBookingFormData = z.infer<typeof appointmentBookingSchema>

// ── Billing & Ledger Schemas ──────────────────────────────────────────────
export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(2, 'Description must be at least 2 characters').max(150, 'Description cannot exceed 150 characters'),
  amount: z.coerce.number().positive('Amount must be greater than ₹0').max(1000000, 'Amount cannot exceed ₹10,00,000'),
})

export const createInvoiceSchema = z.object({
  patientName: z.string().trim().min(2, 'Patient name must be at least 2 characters').max(100, 'Patient name cannot exceed 100 characters'),
  lineItems: z.array(invoiceLineItemSchema).min(1, 'At least one billing line item is required').max(50, 'Maximum 50 line items per invoice'),
})

export type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>

export const expenseEntrySchema = z.object({
  category: z.enum(['MedicalSupplies', 'Utilities', 'Salaries', 'Rent', 'Maintenance', 'Equipment', 'Other'], {
    message: 'Please select a valid expense category',
  }),
  categoryOther: z.string().trim().max(100).optional(),
  amount: z.coerce.number().positive('Expense amount must be greater than ₹0').max(10000000, 'Amount cannot exceed ₹1,00,00,000'),
  expenseDate: z.string().regex(ISO_DATE_REGEX, 'Valid date required (YYYY-MM-DD)'),
  note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional().or(z.literal('')),
})

export type ExpenseEntryFormData = z.infer<typeof expenseEntrySchema>

// ── Consultation Schemas ──────────────────────────────────────────────────
export const prescriptionItemSchema = z.object({
  medicine: z.string().trim().min(2, 'Medicine name is required').max(200, 'Medicine name cannot exceed 200 characters'),
  dosage: z.string().trim().min(1, 'Dosage is required (e.g. 1 Tab, 5ml)').max(100),
  frequency: z.string().trim().min(1, 'Frequency is required (e.g. TID, BID, OD)').max(100),
  duration: z.string().trim().min(1, 'Duration is required (e.g. 5 Days, 1 Month)').max(100),
})

export const consultationSoapSchema = z.object({
  chiefComplaint: z.string().trim().min(3, 'Chief complaint must be at least 3 characters').max(1000, 'Chief complaint cannot exceed 1000 characters'),
  observations: z.string().trim().max(2500, 'Observations cannot exceed 2500 characters').optional().or(z.literal('')),
  diagnosis: z.string().trim().min(2, 'Diagnosis must be at least 2 characters').max(500, 'Diagnosis cannot exceed 500 characters'),
  prescriptions: z.array(prescriptionItemSchema).max(30, 'Maximum 30 prescription items per consultation'),
})

export type ConsultationSoapFormData = z.infer<typeof consultationSoapSchema>

// ── Pharmacy Schemas ──────────────────────────────────────────────────────
export const addDrugBatchSchema = z.object({
  batchNumber: z.string().trim().min(2, 'Batch number must be at least 2 characters').max(50, 'Batch number cannot exceed 50 characters'),
  expiryDate: z.string().regex(ISO_DATE_REGEX, 'Valid date required (YYYY-MM-DD)').refine(d => {
    const today = new Date().toISOString().split('T')[0]
    return d > today
  }, { message: 'Batch expiry date must be in the future' }),
  purchasePrice: z.coerce.number().positive('Purchase price must be greater than ₹0').max(500000),
  mrp: z.coerce.number().positive('MRP must be greater than ₹0').max(500000),
  quantity: z.coerce.number().int().positive('Pack quantity must be at least 1').max(100000),
  rackLocation: z.string().trim().max(50).optional().or(z.literal('')),
  supplierInvoiceNumber: z.string().trim().max(100).optional().or(z.literal('')),
}).refine(data => data.mrp >= data.purchasePrice, {
  message: 'MRP must be greater than or equal to Purchase Price',
  path: ['mrp'],
})

export type AddDrugBatchFormData = z.infer<typeof addDrugBatchSchema>

export const pharmacyPosCustomerSchema = z.object({
  customerName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional().or(z.literal('')),
  customerPhone: z.string().trim().regex(PHONE_REGEX, 'Must be a valid 10-digit mobile number').optional().or(z.literal('')),
  doctorRegistrationNumber: z.string().trim().max(50).optional().or(z.literal('')),
  paymentMethod: z.enum(['Cash', 'UPI', 'Card', 'Credit'], {
    message: 'Please select a valid payment method',
  }),
})

export type PharmacyPosCustomerFormData = z.infer<typeof pharmacyPosCustomerSchema>

// ── Inventory Schemas ─────────────────────────────────────────────────────
export const inventoryItemSchema = z.object({
  itemName: z.string().trim().min(2, 'Item name must be at least 2 characters').max(150, 'Item name cannot exceed 150 characters'),
  category: z.string().trim().min(2, 'Category is required').max(100),
  currentStock: z.coerce.number().int().min(0, 'Current stock cannot be negative').max(1000000),
  reorderLevel: z.coerce.number().int().min(0, 'Reorder level cannot be negative').max(1000000),
  unit: z.string().trim().min(1, 'Unit of measurement is required (e.g. Box, Pcs, Bottle)').max(50),
})

export type InventoryItemFormData = z.infer<typeof inventoryItemSchema>

// ── Settings Schemas ──────────────────────────────────────────────────────
export const clinicProfileSchema = z.object({
  name: z.string().trim().min(2, 'Clinic name must be at least 2 characters').max(150, 'Clinic name cannot exceed 150 characters'),
})

export const clinicSpecialHourSchema = z.object({
  date: z.string().regex(ISO_DATE_REGEX, 'Valid date required (YYYY-MM-DD)'),
  open: z.string().regex(TIME_HH_MM_REGEX, 'Open time must be in HH:mm format'),
  close: z.string().regex(TIME_HH_MM_REGEX, 'Close time must be in HH:mm format'),
  reason: z.string().trim().max(200, 'Reason cannot exceed 200 characters').optional().or(z.literal('')),
}).refine(data => data.close > data.open, {
  message: 'Close time must be after open time',
  path: ['close'],
})

export const clinicHolidaySchema = z.object({
  name: z.string().trim().min(2, 'Holiday name is required').max(100),
  startDate: z.string().regex(ISO_DATE_REGEX, 'Valid start date required'),
  endDate: z.string().regex(ISO_DATE_REGEX, 'Valid end date required'),
  recurringAnnually: z.boolean().default(false),
  internalNote: z.string().trim().max(300).optional().or(z.literal('')),
}).refine(data => data.endDate >= data.startDate, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
})

// ── Staff & Auth Schemas ──────────────────────────────────────────────────
export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, 'Staff name must be at least 2 characters').max(100),
  email: z.string().trim().email('Must be a valid email address').max(254),
  role: z.enum(['ClinicAdmin', 'Doctor', 'Receptionist', 'Pharmacist', 'Nurse'], {
    message: 'Please select a valid staff role',
  }),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
})

export type StaffCreateFormData = z.infer<typeof staffCreateSchema>

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormData = z.infer<typeof loginSchema>
