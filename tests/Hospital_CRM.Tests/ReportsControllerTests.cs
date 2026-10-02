using System.Security.Claims;
using System.Text.Json;
using Hospital_CRM.Api.Controllers;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hospital_CRM.Tests;

public class ReportsControllerTests
{
    private const string Month = "2026-06";
    private static readonly DateOnly MonthStart = new(2026, 6, 1);
    private static readonly DateTimeOffset InMonth = new(2026, 6, 15, 10, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset OutOfMonth = new(2026, 7, 5, 10, 0, 0, TimeSpan.Zero);

    private HospitalCrmDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new HospitalCrmDbContext(options);
    }

    private ReportsController CreateController(HospitalCrmDbContext db, Guid userId, Guid? clinicId = null)
    {
        var user = new User
        {
            Id = userId,
            Name = "Admin Test",
            Role = UserRole.ClinicAdmin,
            ClinicId = clinicId,
            Email = "admin.test@samstack.ai",
            PasswordHash = "hash"
        };
        db.Users.Add(user);
        db.SaveChanges();

        var controller = new ReportsController(db);
        var identity = new ClaimsIdentity(new[] { new Claim("sub", userId.ToString()) }, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }

    private static async Task<(Invoice invoice, Payment payment)> SeedPayment(
        HospitalCrmDbContext db, Guid? clinicId, decimal amount, PaymentMethod method,
        PaymentStatus status = PaymentStatus.Completed, DateTimeOffset? paidAt = null,
        string? walkInName = null)
    {
        var appointmentId = (Guid?)null;
        if (clinicId.HasValue)
        {
            var appointment = new Appointment
            {
                Id = Guid.NewGuid(),
                DoctorId = Guid.NewGuid(),
                PatientId = Guid.NewGuid(),
                ClinicId = clinicId.Value,
                Date = DateOnly.FromDateTime(InMonth.UtcDateTime),
                TimeSlot = "10:00",
                Status = AppointmentStatus.Completed,
                CreatedAt = InMonth
            };
            db.Appointments.Add(appointment);
            appointmentId = appointment.Id;
        }

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = Random.Shared.Next(1, 999999),
            AppointmentId = appointmentId,
            WalkInCustomerName = walkInName,
            Subtotal = amount,
            GstAmount = Math.Round(amount * 0.18m, 2),
            Total = amount + Math.Round(amount * 0.18m, 2),
            Status = InvoiceStatus.Paid,
            CreatedAt = InMonth
        };
        db.Invoices.Add(invoice);

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            Method = method,
            Amount = amount,
            Status = status,
            PaidAt = paidAt ?? InMonth,
            CreatedAt = paidAt ?? InMonth
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();
        return (invoice, payment);
    }

    private static JsonElement AsJson(object? value) =>
        JsonDocument.Parse(JsonSerializer.Serialize(value)).RootElement;

    [Fact]
    public async Task FinancialSummary_ComputesMonthTotals_AndScopesToClinic()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var clinicA = Guid.NewGuid();
        var clinicB = Guid.NewGuid();
        var controller = CreateController(db, userId, clinicA);

        // clinicA: two completed payments on one invoice (UPI 1000 + Cash 500)
        var (invoiceA, _) = await SeedPayment(db, clinicA, 1000m, PaymentMethod.UPI);
        db.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoiceA.Id,
            Method = PaymentMethod.Cash,
            Amount = 500m,
            Status = PaymentStatus.Completed,
            PaidAt = InMonth,
            CreatedAt = InMonth
        });

        // other clinic (must be excluded), pending payment, out-of-month payment
        await SeedPayment(db, clinicB, 99999m, PaymentMethod.UPI);
        await SeedPayment(db, clinicA, 777m, PaymentMethod.UPI, status: PaymentStatus.Pending);
        await SeedPayment(db, clinicA, 555m, PaymentMethod.UPI, paidAt: OutOfMonth);

        // prior-month payment for MoM change (1500 vs 1000 => +50%)
        await SeedPayment(db, clinicA, 1000m, PaymentMethod.UPI, paidAt: new DateTimeOffset(2026, 5, 10, 10, 0, 0, TimeSpan.Zero));

        db.LedgerExpenses.Add(new LedgerExpense
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            Category = ExpenseCategory.Rent,
            CategoryOther = "",
            Amount = 300m,
            ExpenseDate = new DateOnly(2026, 6, 15),
            RecordedBy = userId,
            CreatedAt = InMonth
        });
        db.LedgerExpenses.Add(new LedgerExpense
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            Category = ExpenseCategory.Rent,
            CategoryOther = "",
            Amount = 999m,
            ExpenseDate = new DateOnly(2026, 7, 2),
            RecordedBy = userId,
            CreatedAt = OutOfMonth
        });
        await db.SaveChangesAsync();

        var result = await controller.FinancialSummary(Month, CancellationToken.None);
        var json = AsJson(Assert.IsType<OkObjectResult>(result).Value);

        Assert.Equal("2026-06", json.GetProperty("month").GetString());
        Assert.Equal(1500m, json.GetProperty("grossIncome").GetDecimal());
        Assert.Equal(300m, json.GetProperty("expenses").GetDecimal());
        Assert.Equal(180m, json.GetProperty("gstLiability").GetDecimal());
        Assert.Equal(1020m, json.GetProperty("netProfit").GetDecimal());
        Assert.Equal(750m, json.GetProperty("deemedIncome44ADA").GetDecimal());
        Assert.Equal(20.0m, json.GetProperty("expensesPercentage").GetDecimal());
        Assert.Equal(68.0m, json.GetProperty("netProfitMargin").GetDecimal());
        Assert.Equal(50.0m, json.GetProperty("grossCollectionsMoMChange").GetDecimal());
        Assert.Equal(1, json.GetProperty("invoiceCount").GetInt32());
        Assert.Equal(2, json.GetProperty("paymentCount").GetInt32());

        var categories = json.GetProperty("expenseByCategory");
        Assert.Equal(1, categories.GetArrayLength());
        Assert.Equal("rent", categories[0].GetProperty("category").GetString());
        Assert.Equal(300m, categories[0].GetProperty("total").GetDecimal());
    }

    [Fact]
    public async Task PaymentDistribution_SplitsMethods_AndComputesPercentages()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var clinicId = Guid.NewGuid();
        var controller = CreateController(db, userId, clinicId);

        var (invoice, _) = await SeedPayment(db, clinicId, 400m, PaymentMethod.UPI);
        foreach (var (method, amount) in new (PaymentMethod, decimal)[]
        {
            (PaymentMethod.Razorpay, 100m),
            (PaymentMethod.Card, 300m),
            (PaymentMethod.NetBanking, 100m),
            (PaymentMethod.Wallet, 100m),
            (PaymentMethod.Cash, 1000m)
        })
        {
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                InvoiceId = invoice.Id,
                Method = method,
                Amount = amount,
                Status = PaymentStatus.Completed,
                PaidAt = InMonth,
                CreatedAt = InMonth
            });
        }
        await db.SaveChangesAsync();

        var result = await controller.PaymentDistribution(Month, CancellationToken.None);
        var json = AsJson(Assert.IsType<OkObjectResult>(result).Value);

        Assert.Equal(500m, json.GetProperty("upiAmount").GetDecimal());
        Assert.Equal(25.0m, json.GetProperty("upiPercentage").GetDecimal());
        Assert.Equal(500m, json.GetProperty("cardAmount").GetDecimal());
        Assert.Equal(25.0m, json.GetProperty("cardPercentage").GetDecimal());
        Assert.Equal(1000m, json.GetProperty("cashAmount").GetDecimal());
        Assert.Equal(50.0m, json.GetProperty("cashPercentage").GetDecimal());
        Assert.Equal(2000m, json.GetProperty("totalCollected").GetDecimal());
        Assert.Equal(50.0m, json.GetProperty("digitalPaymentPercentage").GetDecimal());
    }

    [Fact]
    public async Task PlatformHealth_CountsTenantsUsersConsultations()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var clinicId = Guid.NewGuid();
        var controller = CreateController(db, userId, clinicId);

        db.Users.Add(new User { Id = Guid.NewGuid(), Name = "Doc", Role = UserRole.Doctor, ClinicId = clinicId, Email = "d@x.ai", PasswordHash = "h" });
        db.Users.Add(new User { Id = Guid.NewGuid(), Name = "Platform", Role = UserRole.PlatformAdmin, ClinicId = null, Email = "p@x.ai", PasswordHash = "h" });
        db.Consultations.Add(new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = Guid.NewGuid(),
            DoctorId = userId,
            ChiefComplaint = "c",
            Diagnosis = "d",
            Version = 1,
            CreatedAt = InMonth
        });
        db.Consultations.Add(new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = Guid.NewGuid(),
            DoctorId = userId,
            ChiefComplaint = "c",
            Diagnosis = "d",
            Version = 1,
            CreatedAt = OutOfMonth
        });
        await db.SaveChangesAsync();

        var result = await controller.PlatformHealth(Month, CancellationToken.None);
        var json = AsJson(Assert.IsType<OkObjectResult>(result).Value);

        Assert.Equal(1, json.GetProperty("activeTenants").GetInt32());
        Assert.Equal(3, json.GetProperty("totalUsers").GetInt32());
        Assert.Equal(1, json.GetProperty("monthlyConsultations").GetInt32());
        Assert.Equal("healthy", json.GetProperty("overallStatus").GetString());
    }

    [Fact]
    public async Task GSTR1_SplitsB2BAndB2C_AndExcludesCancelled()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var controller = CreateController(db, userId); // no clinic filter

        await SeedPayment(db, clinicId: null, 1000m, PaymentMethod.Cash, walkInName: "Walk-in A");
        await SeedPayment(db, clinicId: Guid.NewGuid(), 500m, PaymentMethod.Cash);
        var (_, cancelled) = await SeedPayment(db, clinicId: null, 111m, PaymentMethod.Cash, walkInName: "Cancelled");
        var cancelledInvoice = await db.Invoices.FindAsync(cancelled.InvoiceId);
        cancelledInvoice!.Status = InvoiceStatus.Cancelled;
        await db.SaveChangesAsync();

        var result = await controller.GSTR1(Month, CancellationToken.None);
        var json = AsJson(Assert.IsType<OkObjectResult>(result).Value);

        Assert.Equal(2, json.GetProperty("totalInvoices").GetInt32());
        Assert.Equal(1, json.GetProperty("b2bInvoices").GetArrayLength());
        Assert.Equal(1, json.GetProperty("b2cInvoices").GetArrayLength());
        Assert.Equal("Walk-in A", json.GetProperty("b2cInvoices")[0].GetProperty("patientName").GetString());
        Assert.Equal(1500m, json.GetProperty("totalTaxableValue").GetDecimal());
        Assert.Equal(270m, json.GetProperty("totalGst").GetDecimal());
    }

    [Fact]
    public async Task Export_ITR4Csv_ReturnsFileWithComputedRows()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var controller = CreateController(db, userId);
        await SeedPayment(db, clinicId: null, 1000m, PaymentMethod.UPI);

        var result = await controller.Export(new ExportRequest("ITR-4 CSV", Month), CancellationToken.None);

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal("text/csv", file.ContentType);
        Assert.Equal("ITR4-2026-06.csv", file.FileDownloadName);
        var csv = System.Text.Encoding.UTF8.GetString(file.FileContents);
        Assert.Contains("Gross Professional Receipts,1000.00", csv);
        Assert.Contains("Deemed Profit (50%),500.00", csv);
        Assert.Contains("Taxable Income,500.00", csv);
    }

    [Fact]
    public async Task Export_UnsupportedFormat_ReturnsBadRequest()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var controller = CreateController(db, userId);

        var result = await controller.Export(new ExportRequest("Audit PDF", Month), CancellationToken.None);

        var bad = Assert.IsAssignableFrom<ObjectResult>(result);
        Assert.Equal(400, bad.StatusCode);
        Assert.Equal("unsupported_format", AsJson(bad.Value).GetProperty("error").GetString());
    }

    [Fact]
    public async Task FinancialSummary_WithoutIdentity_ReturnsUnauthorized()
    {
        var db = CreateInMemoryDb();
        var controller = new ReportsController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
        };

        var result = await controller.FinancialSummary(Month, CancellationToken.None);

        var unauthorized = Assert.IsAssignableFrom<ObjectResult>(result);
        Assert.Equal(401, unauthorized.StatusCode);
        Assert.Equal("invalid_token", AsJson(unauthorized.Value).GetProperty("error").GetString());
    }
}
