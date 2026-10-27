namespace Hospital_CRM.Domain.Enums;

public enum TaxCategory
{
    Exempt = 0,
    Nil = 1,
    Taxable = 2
}

public enum InvoiceDocumentType
{
    BillOfSupply = 0,
    TaxInvoice = 1
}

public enum PaymentVerificationStatus
{
    Pending = 0,
    Reported = 1,
    Confirmed = 2,
    Rejected = 3
}

public enum FinanceEntryType
{
    InvoiceFinalized = 0,
    PaymentConfirmed = 1,
    RefundProcessed = 2,
    CreditNoteIssued = 3,
    Adjustment = 4,
    Reversal = 5,
    DepositCollected = 6,
    DepositApplied = 7,
    DepositRefunded = 8
}
