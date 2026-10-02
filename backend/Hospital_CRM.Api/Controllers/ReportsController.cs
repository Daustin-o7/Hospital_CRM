using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
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

        var tenantId = Guid.Empty;
        var clinicId = await GetUserClinicId(userId.Value, ct);

        // Income from completed payments
        var paymentsQuery = _db.Payments
            .Include(p => p.Invoice)
            .Where(p => p.Status == PaymentStatus.Completed
                     && p.PaidAt >= startDt
                     && p.PaidAt < endDt);

        if (clinicId.HasValue)
            paymentsQuery = paymentsQuery.Where(p => p.Invoice.Appointment.ClinicId == clinicId.Value);

        var payments = await paymentsQuery.ToListAsync(ct);

        var grossIncome = payments.Sum(p => p.Amount);
        // GST is per-invoice — group by invoice so partially-paid invoices aren't double-counted
        var gstLiability = payments
            .Where(p => p.Invoice != null)
            .GroupBy(p => new { p.InvoiceId, p.Invoice.GstAmount })
            .Sum(g => g.Key.GstAmount);

        // Expenses
        var expensesQuery = _db.LedgerExpenses
            .Where(e => e.TenantId == Guid.Empty && e.ExpenseDate >= startDate && e.ExpenseDate < endDate);

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

        var clinicId = await GetUserClinicId(User.GetUserId().Value, ct);

        var paymentsQuery = _db.Payments
            .Include(p => p.Invoice)
            .Where(p => p.Status == PaymentStatus.Completed
                     && p.PaidAt >= startDt
                     && p.PaidAt < endDt);

        if (clinicId.HasValue)
            paymentsQuery = paymentsQuery.Where(p => p.Invoice.Appointment.ClinicId == clinicId.Value);

        var payments = await paymentsQuery.ToListAsync(ct);

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
        var endDate = startDate.AddMonths(1);
        var startDt = startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endDt = endDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var clinicId = await GetUserClinicId(User.GetUserId().Value, ct);

        var invoicesQuery = _db.Invoices
            .Include(i => i.Appointment).ThenInclude(a => a.Patient)
            .Where(i => i.CreatedAt >= startDt && i.CreatedAt < endDt && i.Status != InvoiceStatus.Cancelled);

        if (clinicId.HasValue)
            invoicesQuery = invoicesQuery.Where(i => i.Appointment.ClinicId == clinicId.Value);

        var invoices = await invoicesQuery
            .Include(i => i.LineItems)
            .ToListAsync(ct);

        var b2bInvoices = invoices
            .Where(i => i.Appointment != null) // B2B = patient invoices
            .Select(i => new
            {
                invoiceNumber = $"INV-{i.InvoiceNumber:D6}",
                invoiceDate = i.CreatedAt.ToString("yyyy-MM-dd"),
                patientName = i.Appointment?.Patient?.Name ?? i.WalkInCustomerName ?? "Unknown",
                patientGstin = (string?)null, // Not captured
                invoiceValue = i.Total,
                taxableValue = i.Subtotal,
                gstRate = 18,
                gstAmount = i.GstAmount,
                placeOfSupply = "27", // Maharashtra default
                invoiceType = "B2B"
            })
            .ToList();

        var b2cInvoices = invoices
            .Where(i => i.Appointment == null) // B2C = walk-in / pharmacy
            .Select(i => new
            {
                invoiceNumber = $"INV-{i.InvoiceNumber:D6}",
                invoiceDate = i.CreatedAt.ToString("yyyy-MM-dd"),
                patientName = i.WalkInCustomerName ?? "Walk-in Customer",
                invoiceValue = i.Total,
                taxableValue = i.Subtotal,
                gstRate = 18,
                gstAmount = i.GstAmount,
                placeOfSupply = "27",
                invoiceType = "B2C"
            })
            .ToList();

        return Ok(new
        {
            month = $"{year:D4}-{monthNum:D2}",
            b2bInvoices,
            b2cInvoices,
            totalInvoices = invoices.Count,
            totalTaxableValue = invoices.Sum(i => i.Subtotal),
            totalGst = invoices.Sum(i => i.GstAmount)
        });
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
                var invoices = await QueryInvoices(startDt, endDt, clinicId).ToListAsync(ct);
                var payload = new
                {
                    month,
                    b2bInvoices = invoices.Where(i => i.Appointment != null).Select(i => new
                    {
                        invoiceNumber = $"INV-{i.InvoiceNumber:D6}",
                        invoiceDate = i.CreatedAt.ToString("yyyy-MM-dd"),
                        patientName = i.Appointment?.Patient?.Name ?? i.WalkInCustomerName ?? "Unknown",
                        invoiceValue = i.Total,
                        taxableValue = i.Subtotal,
                        gstRate = 18,
                        gstAmount = i.GstAmount,
                        invoiceType = "B2B"
                    }),
                    b2cInvoices = invoices.Where(i => i.Appointment == null).Select(i => new
                    {
                        invoiceNumber = $"INV-{i.InvoiceNumber:D6}",
                        invoiceDate = i.CreatedAt.ToString("yyyy-MM-dd"),
                        patientName = i.WalkInCustomerName ?? "Walk-in Customer",
                        invoiceValue = i.Total,
                        taxableValue = i.Subtotal,
                        gstRate = 18,
                        gstAmount = i.GstAmount,
                        invoiceType = "B2C"
                    }),
                    totalInvoices = invoices.Count,
                    totalTaxableValue = invoices.Sum(i => i.Subtotal),
                    totalGst = invoices.Sum(i => i.GstAmount)
                };
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
            .Include(p => p.Invoice)
            .Where(p => p.Status == PaymentStatus.Completed
                     && p.PaidAt >= startDt
                     && p.PaidAt < endDt);

        if (clinicId.HasValue)
            query = query.Where(p => p.Invoice.Appointment.ClinicId == clinicId.Value);

        return query;
    }

    private IQueryable<Invoice> QueryInvoices(DateTime startDt, DateTime endDt, Guid? clinicId)
    {
        var query = _db.Invoices
            .Include(i => i.Appointment).ThenInclude(a => a.Patient)
            .Where(i => i.CreatedAt >= startDt && i.CreatedAt < endDt && i.Status != InvoiceStatus.Cancelled);

        if (clinicId.HasValue)
            query = query.Where(i => i.Appointment.ClinicId == clinicId.Value);

        return query;
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
