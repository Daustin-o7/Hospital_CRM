using System.Security.Claims;
using System.Text.Json;
using Hospital_CRM.Api.Controllers;
using Hospital_CRM.Api.Services.Typesense;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Hospital_CRM.Tests;

public class SyncControllerTests
{
    private HospitalCrmDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new HospitalCrmDbContext(options);
    }

    private SyncController CreateController(HospitalCrmDbContext db, Guid userId)
    {
        var searchMock = new FakePatientSearchService();
        var controller = new SyncController(db, searchMock, NullLogger<SyncController>.Instance);

        var claims = new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("role", "ClinicAdmin")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };

        return controller;
    }

    [Fact]
    public async Task Push_Patient_CreatesRecord_AndRecordsConsent()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var controller = CreateController(db, userId);

        var payload = new PatientSyncPayload(
            Name: "John Doe",
            Phone: "9876543210",
            Dob: new DateOnly(1990, 1, 1),
            ApproxAge: null,
            Gender: "Male",
            Address: "123 Main St",
            Consent: new PatientConsentSyncPayload(true, "General OPD")
        );

        var request = new SyncPushRequest(new List<SyncPushItem>
        {
            new(
                Id: Guid.NewGuid(),
                Type: 1,
                IdempotencyKey: $"IDEMP-PAT-{Guid.NewGuid()}",
                PayloadJson: JsonSerializer.Serialize(payload),
                CreatedAt: DateTimeOffset.UtcNow
            )
        });

        var actionResult = await controller.Push(request, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        var response = Assert.IsType<SyncPushResponse>(okResult.Value);

        Assert.Equal(1, response.Synced);
        Assert.Equal(0, response.Skipped);
        Assert.Single(response.Results);
        Assert.Equal("created", response.Results[0].Status);

        var savedPatient = await db.Patients.FirstOrDefaultAsync(p => p.Phone == "9876543210");
        Assert.NotNull(savedPatient);
        Assert.Equal("John Doe", savedPatient.Name);

        var savedConsent = await db.PatientConsents.FirstOrDefaultAsync(c => c.PatientId == savedPatient.Id);
        Assert.NotNull(savedConsent);
        Assert.Equal("General OPD", savedConsent.Purpose);
    }

    [Fact]
    public async Task Push_Invoice_Allows_RegisteredPatient_Or_WalkInCustomer()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var controller = CreateController(db, userId);

        var registeredPatientId = Guid.NewGuid();
        var registeredPatient = new Patient
        {
            Id = registeredPatientId,
            Name = "Alice Smith",
            Phone = "9988776655",
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = userId
        };
        db.Patients.Add(registeredPatient);
        await db.SaveChangesAsync();

        // 1. Registered Patient Invoice (PatientId present, WalkIn blank)
        var inv1Payload = new InvoiceSyncPayload(
            PatientId: registeredPatientId,
            Subtotal: 1000m,
            GstAmount: 180m,
            Total: 1180m,
            PaymentMethod: "Cash",
            WalkInCustomerName: null,
            WalkInCustomerPhone: null,
            Status: "Paid"
        );

        // 2. Walk-in Customer Invoice (PatientId null, WalkIn present)
        var inv2Payload = new InvoiceSyncPayload(
            PatientId: null,
            Subtotal: 500m,
            GstAmount: 90m,
            Total: 590m,
            PaymentMethod: "Cash",
            WalkInCustomerName: "Bob Walk-in",
            WalkInCustomerPhone: "9123456780",
            Status: "Paid"
        );

        var request = new SyncPushRequest(new List<SyncPushItem>
        {
            new(Guid.NewGuid(), 2, $"IDEMP-INV-{Guid.NewGuid()}", JsonSerializer.Serialize(inv1Payload), DateTimeOffset.UtcNow),
            new(Guid.NewGuid(), 2, $"IDEMP-INV-{Guid.NewGuid()}", JsonSerializer.Serialize(inv2Payload), DateTimeOffset.UtcNow)
        });

        var actionResult = await controller.Push(request, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        var response = Assert.IsType<SyncPushResponse>(okResult.Value);

        Assert.Equal(2, response.Synced);
        Assert.Equal(0, response.Skipped);

        var invoices = await db.Invoices.ToListAsync();
        Assert.Equal(2, invoices.Count);

        var patientInvoice = invoices.FirstOrDefault(i => i.PatientId == registeredPatientId);
        Assert.NotNull(patientInvoice);
        Assert.Equal(1180m, patientInvoice.Total);

        var walkInInvoice = invoices.FirstOrDefault(i => i.WalkInCustomerName == "Bob Walk-in");
        Assert.NotNull(walkInInvoice);
        Assert.Equal(590m, walkInInvoice.Total);

        // Regression: offline invoices must allocate InvoiceNumber (else all render INV-000000)
        // and must mint a Payment row (Ledger income sums Payments, not Invoices).
        Assert.All(invoices, i => Assert.True(i.InvoiceNumber > 0));
        Assert.Equal(2, invoices.Select(i => i.InvoiceNumber).Distinct().Count());

        var payments = await db.Payments.ToListAsync();
        Assert.Equal(2, payments.Count);
        Assert.All(payments, p => Assert.Equal(PaymentStatus.Completed, p.Status));
        Assert.All(payments, p => Assert.NotNull(p.PaidAt));
        Assert.Equal(1180m + 590m, payments.Sum(p => p.Amount));
    }

    [Fact]
    public async Task Push_Rejects_InvalidIdempotencyKey_And_PayloadTooLarge()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var controller = CreateController(db, userId);

        var request = new SyncPushRequest(new List<SyncPushItem>
        {
            // Missing key
            new(Guid.NewGuid(), 1, "", "{}", DateTimeOffset.UtcNow),
            // Invalid key format for patient
            new(Guid.NewGuid(), 1, "INVALID-KEY-FORMAT", "{}", DateTimeOffset.UtcNow),
            // Payload too large (> 64KB)
            new(Guid.NewGuid(), 1, $"IDEMP-PAT-{Guid.NewGuid()}", new string('x', 70000), DateTimeOffset.UtcNow)
        });

        var actionResult = await controller.Push(request, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        var response = Assert.IsType<SyncPushResponse>(okResult.Value);

        Assert.Equal(0, response.Synced);
        Assert.Equal(3, response.Skipped);
        Assert.Contains(response.Results, r => r.Status == "rejected" || r.Status == "invalid_key_format");
    }
}

public class FakePatientSearchService : IPatientSearchService
{
    public virtual Task IndexAsync(Patient patient, CancellationToken ct) => Task.CompletedTask;
    public virtual Task IndexManyAsync(IEnumerable<Patient> patients, CancellationToken ct) => Task.CompletedTask;
    public virtual Task DeleteAsync(Guid id, CancellationToken ct) => Task.CompletedTask;
    public virtual Task<List<PatientSearchHit>> SearchAsync(string query, Guid tenantId, int limit = 10, CancellationToken ct = default) => Task.FromResult(new List<PatientSearchHit>());
    public virtual Task<List<PatientSearchHit>> CheckDuplicatesAsync(string name, string? phone, DateOnly? dob, Guid tenantId, CancellationToken ct = default) => Task.FromResult(new List<PatientSearchHit>());
    public virtual Task IndexMedicineAsync(Drug drug, CancellationToken ct) => Task.CompletedTask;
    public virtual Task IndexManyMedicinesAsync(IEnumerable<Drug> drugs, CancellationToken ct) => Task.CompletedTask;
    public virtual Task<List<MedicineSearchHit>> MedicinesSearchAsync(string query, Guid tenantId, int limit = 10, CancellationToken ct = default) => Task.FromResult(new List<MedicineSearchHit>());
    public virtual Task EnsureCollectionAsync(CancellationToken ct) => Task.CompletedTask;
    public virtual Task EnsureCollectionsAsync(CancellationToken ct) => Task.CompletedTask;
}
