using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/ledger")]
public class LedgerController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public LedgerController(HospitalCrmDbContext db) => _db = db;

    // ----- FR-11-01: Income read directly from invoices/payments -----

    [HttpGet("income")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Income([FromQuery] string? month, CancellationToken ct)
    {
        // month param format: "YYYY-MM" (defaults to current month)
        var (year, monthNum) = ParseMonth(month);

        var tenantId = Guid.Empty;
        var startDate = new DateOnly(year, monthNum, 1);
        var endDate = startDate.AddMonths(1);

        // Sum completed payments where the linked invoice is in the month
        var payments = await _db.Payments
            .Include(p => p.Invoice)
            .Where(p => p.Status == PaymentStatus.Completed
                     && p.PaidAt >= startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)
                     && p.PaidAt < endDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc))
            .ToListAsync(ct);

        var totalIncome = payments.Sum(p => p.Amount);
        var gstCollected = payments.Sum(p => p.Invoice?.GstAmount ?? 0);
        var invoiceCount = payments.Select(p => p.InvoiceId).Distinct().Count();

        return Ok(new
        {
            month = $"{year:D4}-{monthNum:D2}",
            totalIncome,
            gstCollected,
            invoiceCount,
            paymentCount = payments.Count
        });
    }

    // ----- FR-11-02: Manual Expense Entry -----

    [HttpPost("expenses")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> CreateExpense([FromBody] CreateExpenseRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<ExpenseCategory>(request.Category, true, out var category))
            return BadRequest(new { error = "invalid_category" });

        if (request.Amount <= 0)
            return BadRequest(new { error = "amount_must_be_positive" });

        if (!DateOnly.TryParse(request.ExpenseDate, out var date))
            return BadRequest(new { error = "invalid_date" });

        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var expense = new LedgerExpense
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            Category = category,
            CategoryOther = category == ExpenseCategory.Other
                ? (request.CategoryOther ?? request.Category)
                : category.ToString(),
            Amount = request.Amount,
            ExpenseDate = date,
            Note = request.Note,
            RecordedBy = userId.Value,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.LedgerExpenses.Add(expense);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = expense.Id,
            category = expense.Category.ToString().ToLower(),
            amount = expense.Amount,
            expenseDate = expense.ExpenseDate.ToString("yyyy-MM-dd")
        });
    }

    [HttpPatch("expenses/{id:guid}")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> UpdateExpense(Guid id, [FromBody] UpdateExpenseRequest request, CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var expense = await _db.LedgerExpenses.FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId, ct);
        if (expense is null)
            return NotFound(new { error = "expense_not_found" });

        if (request.Amount.HasValue && request.Amount.Value > 0)
            expense.Amount = request.Amount.Value;

        if (!string.IsNullOrWhiteSpace(request.Category) &&
            Enum.TryParse<ExpenseCategory>(request.Category, true, out var category))
        {
            expense.Category = category;
            expense.CategoryOther = category == ExpenseCategory.Other
                ? (request.CategoryOther ?? request.Category)
                : category.ToString();
        }

        if (!string.IsNullOrWhiteSpace(request.Note))
            expense.Note = request.Note;

        if (DateOnly.TryParse(request.ExpenseDate, out var date))
            expense.ExpenseDate = date;

        // FR-11-02 edge case: edit logged via EditedAt
        expense.EditedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = expense.Id,
            category = expense.Category.ToString().ToLower(),
            amount = expense.Amount,
            editedAt = expense.EditedAt
        });
    }

    [HttpGet("expenses")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> ListExpenses([FromQuery] string? month, CancellationToken ct)
    {
        var (year, monthNum) = ParseMonth(month);
        var tenantId = Guid.Empty;
        var startDate = new DateOnly(year, monthNum, 1);
        var endDate = startDate.AddMonths(1);

        var expenses = await _db.LedgerExpenses
            .Where(e => e.TenantId == tenantId && e.ExpenseDate >= startDate && e.ExpenseDate < endDate)
            .OrderByDescending(e => e.ExpenseDate)
            .Select(e => new
            {
                id = e.Id,
                category = e.Category.ToString().ToLower(),
                amount = e.Amount,
                expenseDate = e.ExpenseDate.ToString("yyyy-MM-dd"),
                note = e.Note,
                editedAt = e.EditedAt
            })
            .ToListAsync(ct);

        return Ok(expenses);
    }

    // ----- FR-11-03: Monthly Summary (JSON only for now; export format unconfirmed per FRD) -----

    [HttpGet("summary")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Summary([FromQuery] string? month, CancellationToken ct)
    {
        var (year, monthNum) = ParseMonth(month);
        var monthLabel = $"{year:D4}-{monthNum:D2}";
        var tenantId = Guid.Empty;
        var startDate = new DateOnly(year, monthNum, 1);
        var endDate = startDate.AddMonths(1);

        // Income (from payments, no separate table — FR-11-01 reconciliation)
        var income = await _db.Payments
            .Include(p => p.Invoice)
            .Where(p => p.Status == PaymentStatus.Completed
                     && p.PaidAt >= startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)
                     && p.PaidAt < endDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc))
            .SumAsync(p => p.Amount, ct);

        // Expenses (from ledger_expenses, aggregated by category)
        var expenseByCategory = await _db.LedgerExpenses
            .Where(e => e.TenantId == tenantId && e.ExpenseDate >= startDate && e.ExpenseDate < endDate)
            .GroupBy(e => e.Category)
            .Select(g => new
            {
                category = g.Key.ToString().ToLower(),
                total = g.Sum(e => e.Amount)
            })
            .ToListAsync(ct);

        var totalExpenses = expenseByCategory.Sum(x => x.total);

        return Ok(new
        {
            month = monthLabel,
            income,
            expenses = new
            {
                total = totalExpenses,
                byCategory = expenseByCategory
            },
            net = income - totalExpenses,
            // FR-11-03: format parameter is acknowledged but not yet implemented —
            // the spec explicitly flags export format as unconfirmed for pilot validation
            exportFormat = "json"
        });
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

public record CreateExpenseRequest(string Category, string? CategoryOther, decimal Amount, string ExpenseDate, string? Note);
public record UpdateExpenseRequest(decimal? Amount, string? Category, string? CategoryOther, string? Note, string? ExpenseDate);
