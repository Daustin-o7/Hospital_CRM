using Hospital_CRM.Domain.Entities;

namespace Hospital_CRM.Domain.Utils;

public static class IndianFinancialYearUtils
{
    /// <summary>
    /// Computes the Indian Financial Year string (April 1 to March 31).
    /// For example:
    /// - 2026-04-01 -> "2026-27"
    /// - 2026-10-26 -> "2026-27"
    /// - 2027-03-31 -> "2026-27"
    /// - 2027-04-01 -> "2027-28" (New FY begins, sequences reset)
    /// </summary>
    public static string GetFinancialYear(DateOnly date)
    {
        int startYear = date.Month >= 4 ? date.Year : date.Year - 1;
        int endYearShort = (startYear + 1) % 100;
        return $"{startYear}-{endYearShort:D2}";
    }

    public static string GetFinancialYear(DateTime dateTime) =>
        GetFinancialYear(DateOnly.FromDateTime(dateTime));

    public static string GetFinancialYear(DateTimeOffset dateTimeOffset) =>
        GetFinancialYear(DateOnly.FromDateTime(dateTimeOffset.DateTime));
}

public static class InvoiceNumberingExtensions
{
    public static string FormatInvoiceNumber(this Invoice invoice)
    {
        if (invoice.InvoiceNumber <= 0) return "DRAFT";
        var series = string.IsNullOrEmpty(invoice.Series) ? "INV" : invoice.Series;
        return $"{series}-{invoice.FinancialYear}-{invoice.InvoiceNumber:D6}";
    }

    public static string FormatCreditNoteNumber(this CreditNote cn)
    {
        if (!string.IsNullOrEmpty(cn.CreditNoteNumber)) return cn.CreditNoteNumber;
        var series = string.IsNullOrEmpty(cn.Series) ? "CN" : cn.Series;
        return $"{series}-{cn.FinancialYear}-{cn.SequenceNumber:D6}";
    }
}
