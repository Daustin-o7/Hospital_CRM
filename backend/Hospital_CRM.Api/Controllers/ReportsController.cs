using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
        var gstLiability = payments.Sum(p => p.Invoice?.GstAmount ?? 0);

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

        return Ok(new
        {
            month = $"{year:D4}-{monthNum:D2}",
            grossIncome,
            expenses = totalExpenses,
            gstLiability,
            netProfit,
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

    [HttpPost("export")]
    public async Task<IActionResult> Export([FromBody] ExportRequest request, CancellationToken ct)
    {
        // For now, return the data in requested format
        // In production, this would generate actual CSV/PDF
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        return Ok(new
        {
            format = request.Format,
            message = $"Export of {request.Format} for {request.Month} queued for generation",
            downloadUrl = $"/api/v1/reports/download/{Guid.NewGuid()}"
        });
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
