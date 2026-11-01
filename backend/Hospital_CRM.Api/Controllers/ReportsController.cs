using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Utils;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/reports")]
[AuthorizeRoles("ClinicAdmin", "Doctor", "Pharmacist")]
public class ReportsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public ReportsController(HospitalCrmDbContext db)
    {
        _db = db;
    }

    // ----- FR-11: Financial Analytics & Tax Audit Reports -----

    [HttpGet("financial")]
    public async Task<IActionResult> FinancialSummary([FromQuery] string? month, CancellationToken ct)
    {
        var userId = User.GetUserId();
        var userRole = User.GetUserRole();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var (year, monthNum) = ParseMonth(month);
        var startDate = new DateOnly(year, monthNum, 1);
        var endDate = startDate.AddMonths(1);
        var startDt = startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endDt = endDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var tenantId = User.GetTenantId() ?? Guid.Empty;
        var clinicId = await GetUserClinicId(userId.Value, ct);

        // Income from completed payments
        var payments = await QueryPayments(startDt, endDt, clinicId).ToListAsync(ct);

        var grossIncome = payments.Sum(p => p.Amount);
        // GST is per-invoice — group by invoice so partially-paid invoices aren't double-counted
        var gstLiability = payments
            .Where(p => p.Invoice != null)
            .GroupBy(p => new { p.InvoiceId, p.Invoice.GstAmount })
            .Sum(g => g.Key.GstAmount);

        // Expenses
        var expensesQuery = _db.LedgerExpenses
            .Where(e => e.TenantId == tenantId && e.ExpenseDate >= startDate && e.ExpenseDate < endDate);

        if (clinicId.HasValue)
        {
            // Note: LedgerExpense doesn't have ClinicId directly, using TenantId for now
        }

        var expenses = await expensesQuery.ToListAsync(ct);
        var totalExpenses = expenses.Sum(e => e.Amount);
        var expenseByCategory = expenses
            .GroupBy(e => e.Category)
            .Select(g => new { category = g.Key.ToString().ToLower(), total = g.Sum(e => e.Amount) })
            .ToList();

        var netProfit = grossIncome - totalExpenses - gstLiability;

        // Section 44ADA: 50% deemed profit for medical professionals
        var deemedIncome44ADA = Math.Round(grossIncome * 0.5m, 2);

        // Prior month for MoM comparison
        var prevStartDt = startDate.AddMonths(-1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var prevGross = await QueryPayments(prevStartDt, startDt, clinicId).SumAsync(p => p.Amount, ct);
        var grossCollectionsMoMChange = prevGross == 0 ? 0m : Math.Round((grossIncome - prevGross) / prevGross * 100m, 1);
        var expensesPercentage = grossIncome == 0 ? 0m : Math.Round(totalExpenses / grossIncome * 100m, 1);
        var netProfitMargin = grossIncome == 0 ? 0m : Math.Round(netProfit / grossIncome * 100m, 1);

        return Ok(new
        {
            month = $"{year:D4}-{monthNum:D2}",
            grossIncome,
            expenses = totalExpenses,
            expensesPercentage,
            gstLiability,
            netProfit,
            netProfitMargin,
            grossCollectionsMoMChange,
            deemedIncome44ADA,
            expenseByCategory,
            invoiceCount = payments.Select(p => p.InvoiceId).Distinct().Count(),
            paymentCount = payments.Count
        });
    }

    [HttpGet("tax/itr4")]
    public async Task<IActionResult> ITR4([FromQuery] string? month, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var (year, monthNum) = ParseMonth(month);
        var startDate = new DateOnly(year, monthNum, 1);
        var endDate = startDate.AddMonths(1);
        var startDt = startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endDt = endDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var clinicId = await GetUserClinicId(userId.Value, ct);

        var payments = await QueryPayments(startDt, endDt, clinicId).ToListAsync(ct);

        var grossReceipts = payments.Sum(p => p.Amount);
        var deemedProfit = Math.Round(payments.Sum(p => p.Amount) * 0.5m, 2);
        var taxableIncome = deemedProfit;

        return Ok(new
        {
            month = $"{year:D4}-{monthNum:D2}",
            grossReceipts,
            deemedProfitRate = "50%",
            deemedProfit,
            taxableIncome,
            taxRate = "As per slab",
            note = "Section 44ADA: 50% of gross receipts deemed as profit for medical professionals with gross receipts up to ₹50 Lakhs"
        });
    }

    [HttpGet("tax/gstr1")]
    public async Task<IActionResult> GSTR1([FromQuery] string? month, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var (year, monthNum) = ParseMonth(month);
        var startDate = new DateOnly(year, monthNum, 1);
        var startDt = startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endDt = startDate.AddMonths(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var clinicId = await GetUserClinicId(userId.Value, ct);

        return Ok(await BuildGstr1Async($"{year:D4}-{monthNum:D2}", startDt, endDt, clinicId, ct));
    }

    [HttpGet("payment-distribution")]
    public async Task<IActionResult> PaymentDistribution([FromQuery] string? month, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var (year, monthNum) = ParseMonth(month);
        var startDt = new DateOnly(year, monthNum, 1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endDt = startDt.AddMonths(1);
        var clinicId = await GetUserClinicId(userId.Value, ct);

        var payments = await QueryPayments(startDt, endDt, clinicId).ToListAsync(ct);

        var total = payments.Sum(p => p.Amount);
        var upi = payments.Where(p => p.Method is PaymentMethod.UPI or PaymentMethod.Razorpay).Sum(p => p.Amount);
        var card = payments.Where(p => p.Method is PaymentMethod.Card or PaymentMethod.NetBanking or PaymentMethod.Wallet).Sum(p => p.Amount);
        var cash = payments.Where(p => p.Method == PaymentMethod.Cash).Sum(p => p.Amount);
        static decimal Pct(decimal amount, decimal total) => total == 0 ? 0m : Math.Round(amount / total * 100m, 1);

        return Ok(new
        {
            month = $"{year:D4}-{monthNum:D2}",
            upiAmount = upi,
            upiPercentage = Pct(upi, total),
            cardAmount = card,
            cardPercentage = Pct(card, total),
            cashAmount = cash,
            cashPercentage = Pct(cash, total),
            totalCollected = total,
            digitalPaymentPercentage = Pct(total - cash, total)
        });
    }

    [HttpGet("platform-health")]
    public async Task<IActionResult> PlatformHealth([FromQuery] string? month, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var (year, monthNum) = ParseMonth(month);
        var startDt = new DateOnly(year, monthNum, 1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endDt = startDt.AddMonths(1);

        var activeTenants = await _db.Users
            .Where(u => u.ClinicId != null)
            .Select(u => u.ClinicId)
            .Distinct()
            .CountAsync(ct);
        var totalUsers = await _db.Users.CountAsync(ct);
        var monthlyConsultations = await _db.Consultations
            .CountAsync(c => c.CreatedAt >= startDt && c.CreatedAt < endDt, ct);

        return Ok(new
        {
            month = $"{year:D4}-{monthNum:D2}",
            activeTenants,
            totalUsers,
            monthlyConsultations,
            overallStatus = totalUsers > 0 ? "healthy" : "degraded"
        });
    }

    [HttpPost("export")]
    public async Task<IActionResult> Export([FromBody] ExportRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var (year, monthNum) = ParseMonth(request.Month);
        var month = $"{year:D4}-{monthNum:D2}";
        var startDt = new DateOnly(year, monthNum, 1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endDt = startDt.AddMonths(1);
        var clinicId = await GetUserClinicId(userId.Value, ct);

        switch (request.Format)
        {
            case "ITR-4 CSV":
                {
                    var payments = await QueryPayments(startDt, endDt, clinicId).ToListAsync(ct);
                    var gross = payments.Sum(p => p.Amount);
                    var deemedProfit = Math.Round(gross * 0.5m, 2);
                    var sb = new StringBuilder();
                    sb.AppendLine("Section 44ADA Computation,Value (INR)");
                    sb.AppendLine($"Gross Professional Receipts,{gross:0.00}");
                    sb.AppendLine($"Deemed Profit (50%),{deemedProfit:0.00}");
                    sb.AppendLine($"Taxable Income,{deemedProfit:0.00}");
                    sb.AppendLine();
                    sb.AppendLine("Paid At,Invoice,Method,Amount");
                    foreach (var p in payments.OrderBy(p => p.PaidAt))
                        sb.AppendLine($"{p.PaidAt:yyyy-MM-dd HH:mm},{p.Invoice?.InvoiceNumber ?? 0},{p.Method},{p.Amount:0.00}");
                    return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"ITR4-{month}.csv");
                }
            case "GSTR-1 JSON":
                {
                    var payload = await BuildGstr1Async(month, startDt, endDt, clinicId, ct);
                    var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
                    return File(Encoding.UTF8.GetBytes(json), "application/json", $"GSTR1-{month}.json");
                }
            default:
                return BadRequest(new { error = "unsupported_format" });
        }
    }

    private IQueryable<Payment> QueryPayments(DateTime startDt, DateTime endDt, Guid? clinicId)
    {
        var query = _db.Payments
            .Include(p => p.Invoice).ThenInclude(inv => inv.Appointment)
            .Where(p => p.Status == PaymentStatus.Completed
                     && p.PaidAt >= startDt
                     && p.PaidAt < endDt);

        // Walk-in invoices have no appointment, so there is nothing to clinic-scope them by —
        // excluding them silently dropped all walk-in revenue from every tax report.
        // shortcut: clinic-scoping for walk-in invoices needs the tenant key (Master TODO A3/B1).
        if (clinicId.HasValue)
            query = query.Where(p => p.Invoice.Appointment == null
                                  || p.Invoice.Appointment.ClinicId == clinicId.Value);

        return query;
    }

    private IQueryable<Invoice> QueryInvoices(DateTime startDt, DateTime endDt, Guid? clinicId)
    {
        var query = _db.Invoices
            .Include(i => i.Appointment).ThenInclude(a => a!.Patient)
            // A draft has no legal number yet; cancelled documents are reported separately, never as supply.
            .Where(i => i.CreatedAt >= startDt && i.CreatedAt < endDt
                     && i.InvoiceNumber > 0
                     && i.Status != InvoiceStatus.Draft
                     && i.Status != InvoiceStatus.Cancelled);

        // See QueryPayments: walk-in invoices have no appointment to scope by.
        if (clinicId.HasValue)
            query = query.Where(i => i.Appointment == null
                                  || i.Appointment.ClinicId == clinicId.Value);

        return query;
    }

    private async Task<object> BuildGstr1Async(string month, DateTime startDt, DateTime endDt, Guid? clinicId, CancellationToken ct)
    {
        var tenantId = User.GetTenantId() ?? Guid.Empty;

        var taxProfile = await _db.TenantTaxProfiles.AsNoTracking()
            .Where(p => p.TenantId == tenantId)
            .OrderByDescending(p => p.ClinicId == clinicId)
            .FirstOrDefaultAsync(ct);

        var invoices = await QueryInvoices(startDt, endDt, clinicId)
            .Include(i => i.LineItems)
            .ToListAsync(ct);

        // Credit notes reduce the month's liability and must reach GSTR-1 (Table 9B), not only the ledger.
        var creditNotes = await _db.CreditNotes.AsNoTracking()
            .Include(c => c.Invoice)
            .Where(c => c.TenantId == tenantId
                     && c.Status == CreditNoteStatus.Approved
                     && c.IssuedAt >= startDt && c.IssuedAt < endDt)
            .ToListAsync(ct);

        return BuildGstr1Payload(month, invoices, creditNotes, taxProfile);
    }

    private static object BuildGstr1Payload(
        string month,
        List<Invoice> invoices,
        List<CreditNote> creditNotes,
        TenantTaxProfile? taxProfile)
    {
        var supplierState = taxProfile?.StateCode;
        // OPD supply happens at the clinic, so the place of supply is the supplier's own state.
        var placeOfSupply = supplierState ?? "";
        var isRegistered = taxProfile?.IsGstRegistered == true;

        // No GSTIN is captured for patients, so every invoice is B2C. Table 7 (B2CS) is
        // rate-wise + place-of-supply-wise totals, not one row per invoice.
        var b2cs = invoices
            .SelectMany(i => i.LineItems
                .Where(li => li.ResolvedTaxAmount() > 0)
                .Select(li => new { li.GstRate, Taxable = li.TaxableAmount(), Tax = li.ResolvedTaxAmount() }))
            .GroupBy(l => l.GstRate)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var tax = g.Sum(l => l.Tax);
                var cgst = Math.Round(tax / 2m, 2);
                return new
                {
                    type = "OE",
                    placeOfSupply,
                    rate = g.Key,
                    taxableValue = g.Sum(l => l.Taxable),
                    igstAmount = 0m,
                    cgstAmount = cgst,
                    sgstAmount = tax - cgst,
                    cessAmount = 0m
                };
            })
            .ToList();

        // A line with no resolved tax is a nil/exempt supply, whatever its stored category.
        var exemptLines = invoices
            .SelectMany(i => i.LineItems.Where(li => li.ResolvedTaxAmount() == 0))
            .ToList();

        var nilExempt = new[]
        {
            new
            {
                placeOfSupply,
                nilAmount = exemptLines.Where(l => l.TaxCategory == TaxCategory.Nil).Sum(l => l.TaxableAmount()),
                exemptAmount = exemptLines.Where(l => l.TaxCategory != TaxCategory.Nil).Sum(l => l.TaxableAmount())
            }
        }.Where(n => n.nilAmount > 0 || n.exemptAmount > 0).ToList();

        // Table 12: HSN/SAC summary. Mandatory above ₹5 crore turnover; always useful for reconciliation.
        var hsnSummary = invoices
            .SelectMany(i => i.LineItems.Select(li => new { li.HsnSacCode, li.GstRate, li.Quantity, Taxable = li.TaxableAmount(), Tax = li.ResolvedTaxAmount() }))
            .GroupBy(l => new { l.HsnSacCode, l.GstRate })
            .OrderBy(g => g.Key.HsnSacCode).ThenBy(g => g.Key.GstRate)
            .Select(g =>
            {
                var tax = g.Sum(l => l.Tax);
                var cgst = Math.Round(tax / 2m, 2);
                return new
                {
                    hsnSac = g.Key.HsnSacCode,
                    description = "Healthcare services",
                    uqc = "OTH",
                    quantity = g.Sum(l => l.Quantity),
                    rate = g.Key.GstRate,
                    taxableValue = g.Sum(l => l.Taxable),
                    igstAmount = 0m,
                    cgstAmount = cgst,
                    sgstAmount = tax - cgst,
                    cessAmount = 0m
                };
            })
            .ToList();

        // Table 9B (CDNUR): unregistered credit notes, tax split using the parent invoice's taxable ratio.
        var cdnur = creditNotes
            .Select(cn =>
            {
                var invoiceTotal = cn.Invoice?.Total ?? 0m;
                var taxableFraction = invoiceTotal > 0 ? cn.Invoice!.Subtotal / invoiceTotal : 1m;
                var taxableValue = Math.Round(cn.Amount * taxableFraction, 2);
                var tax = cn.Amount - taxableValue;
                var cgst = Math.Round(tax / 2m, 2);
                return new
                {
                    noteNumber = cn.FormatCreditNoteNumber(),
                    noteDate = cn.IssuedAt.ToString("yyyy-MM-dd"),
                    noteType = "C",
                    noteValue = cn.Amount,
                    taxableValue,
                    rate = taxableValue > 0 ? Math.Round(tax / taxableValue * 100m, 2) : 0m,
                    placeOfSupply,
                    igstAmount = 0m,
                    cgstAmount = cgst,
                    sgstAmount = tax - cgst,
                    cessAmount = 0m
                };
            })
            .ToList();

        var warnings = new List<string>();
        if (!isRegistered) warnings.Add("gst_not_registered");
        if (string.IsNullOrWhiteSpace(supplierState)) warnings.Add("supplier_state_missing");
        if (invoices.Any(i => i.DiscountAmount > 0)) warnings.Add("invoice_level_discount_not_apportioned_to_lines");

        var totalGst = invoices.Sum(i => i.GstAmount);
        var creditNoteTax = cdnur.Sum(c => c.cgstAmount + c.sgstAmount);

        return new
        {
            month,
            supplierGstin = taxProfile?.Gstin,
            supplierStateCode = supplierState,
            placeOfSupply,
            isGstRegistered = isRegistered,
            // A registered-recipient (B2B) section requires a recipient GSTIN, which this app never captures.
            b2bInvoices = Array.Empty<object>(),
            b2cs,
            nilExempt,
            cdnur,
            hsnSummary,
            totalInvoices = invoices.Count,
            totalInvoiceValue = invoices.Sum(i => i.Total),
            totalTaxableValue = b2cs.Sum(b => b.taxableValue),
            totalExemptValue = nilExempt.Sum(n => n.nilAmount + n.exemptAmount),
            totalGst,
            creditNoteValue = creditNotes.Sum(c => c.Amount),
            netTaxPayable = totalGst - creditNoteTax,
            warnings
        };
    }

    private async Task<Guid?> GetUserClinicId(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([userId], ct);
        return user?.ClinicId;
    }

    private static (int year, int month) ParseMonth(string? month)
    {
        if (!string.IsNullOrWhiteSpace(month) &&
            DateOnly.TryParse($"{month}-01", out var parsed))
        {
            return (parsed.Year, parsed.Month);
        }
        var now = DateTime.UtcNow;
        return (now.Year, now.Month);
    }
}

public record ExportRequest(
    string Format, // "ITR-4 CSV" | "GSTR-1 JSON" | "Audit PDF"
    string Month // "YYYY-MM"
);
