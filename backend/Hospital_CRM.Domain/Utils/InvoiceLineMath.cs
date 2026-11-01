using Hospital_CRM.Domain.Entities;

namespace Hospital_CRM.Domain.Utils;

/// <summary>
/// Invoice line amounts are stored in one of two shapes, depending on who wrote the row:
/// OPD lines keep <c>Amount = net + tax</c> with <c>TaxAmount</c> filled in, while pharmacy
/// (MRP-inclusive) lines keep <c>Amount = taxable</c> and leave <c>TaxAmount</c> at zero.
/// These helpers read both shapes correctly so reports and printed documents agree.
/// </summary>
public static class InvoiceLineMath
{
    public static decimal TaxableAmount(this InvoiceLineItem line) =>
        line.TaxAmount > 0 ? line.Amount - line.TaxAmount : line.Amount;

    public static decimal ResolvedTaxAmount(this InvoiceLineItem line)
    {
        if (line.TaxAmount > 0) return line.TaxAmount;
        // MRP-inclusive pharmacy line: gross = qty x printed MRP, tax = gross - taxable.
        if (line.GstRate > 0)
            return Math.Max(0m, Math.Round(line.Quantity * line.UnitPrice - line.Amount, 2));
        return 0m;
    }

    public static decimal GrossAmount(this InvoiceLineItem line) =>
        line.Amount + line.ResolvedTaxAmount();
}
