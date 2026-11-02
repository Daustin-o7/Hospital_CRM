using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Utils;

/// <summary>
/// Line amounts are stored in one of two shapes, decided by the invoice:
/// OPD invoices keep <c>Amount = net + tax</c> with <c>TaxAmount</c> filled in, while pharmacy
/// (MRP-inclusive) invoices keep <c>Amount = net</c> and may leave <c>TaxAmount</c> at zero.
/// These helpers read both shapes correctly so reports and printed documents agree.
/// </summary>
public static class InvoiceLineMath
{
    public static decimal TaxableAmount(this InvoiceLineItem line, InvoiceType invoiceType) =>
        invoiceType == InvoiceType.Pharmacy
            ? line.Amount
            : line.Amount - line.TaxAmount;

    public static decimal ResolvedTaxAmount(this InvoiceLineItem line)
    {
        if (line.TaxAmount > 0) return line.TaxAmount;
        // POS pharmacy line: gross = qty x printed MRP, tax = gross - taxable.
        if (line.GstRate > 0)
            return Math.Max(0m, Math.Round(line.Quantity * line.UnitPrice - line.Amount, 2));
        return 0m;
    }

    public static decimal GrossAmount(this InvoiceLineItem line, InvoiceType invoiceType) =>
        line.TaxableAmount(invoiceType) + line.ResolvedTaxAmount();
}
