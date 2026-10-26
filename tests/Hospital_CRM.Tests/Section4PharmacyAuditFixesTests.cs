using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hospital_CRM.Api.Controllers;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>Regression tests for the Section 4 review fixes (verify semantics, dispense matching, POS truth, recall).</summary>
public class Section4PharmacyAuditFixesTests
{
    private static HospitalCrmDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(databaseName: $"Sec4Audit_{Guid.NewGuid()}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new HospitalCrmDbContext(options);
    }

    private static ClaimsPrincipal CreateUserPrincipal(Guid userId, Guid tenantId, string role)
    {
        var claims = new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("role", role),
            new Claim("tenant_id", tenantId.ToString())
        };
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }

    private static ConsultationsController CreateConsultationsController(HospitalCrmDbContext db, string? shareSecret = null)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Prescription:ShareSecret"] = shareSecret
            })
            .Build();
        return new ConsultationsController(db, NullLogger<ConsultationsController>.Instance, config);
    }

    private static Consultation Version(Guid appointmentId, Guid doctorId, string code, int version, ConsultationStatus status) => new()
    {
        Id = Guid.NewGuid(),
        AppointmentId = appointmentId,
        DoctorId = doctorId,
        Status = status,
        Version = version,
        VerificationQrCode = code,
        CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
        SignedAt = DateTimeOffset.UtcNow.AddDays(-2)
    };

    /// <summary>
    /// Full visit graph. The verify query includes required navigations, so a bare Consultation
    /// with dangling FKs is dropped by the include join.
    /// </summary>
    private static async Task<(Guid AppointmentId, Guid DoctorId, Guid PatientId)> SeedVisitAsync(
        HospitalCrmDbContext db, Guid tenantId)
    {
        var clinic = new Clinic
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Verify Clinic",
            PharmacyLicenceNumber20 = "DL-20-TEST"
        };
        var doctor = new User { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Dr. Verify", Role = UserRole.Doctor };
        var patient = new Patient { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Verify Patient", Phone = "9876543210" };
        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ClinicId = clinic.Id,
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "10:00"
        };
        db.Clinics.Add(clinic);
        db.Users.Add(doctor);
        db.Patients.Add(patient);
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();
        return (appointment.Id, doctor.Id, patient.Id);
    }

    private static string ShareSig(string code, long exp, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{code}:{exp}")));
    }

    [Fact]
    public async Task Verify_NewestAmendedVersion_IsActive_NotSuperseded()
    {
        var db = CreateInMemoryDb();
        var code = "QR-ACTIVE-V2";
        var visit = await SeedVisitAsync(db, Guid.NewGuid());
        db.Consultations.AddRange(
            Version(visit.AppointmentId, visit.DoctorId, code, 1, ConsultationStatus.Amended),
            Version(visit.AppointmentId, visit.DoctorId, code, 2, ConsultationStatus.Amended));
        await db.SaveChangesAsync();

        var result = await CreateConsultationsController(db)
            .VerifyPrescription(code, null, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var doc = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(ok.Value));
        Assert.False(doc.GetProperty("isSuperseded").GetBoolean());
        Assert.Equal("valid", doc.GetProperty("status").GetString());
        Assert.Equal(2, doc.GetProperty("currentVersion").GetInt32());
        Assert.Equal(2, doc.GetProperty("latestVersion").GetInt32());
    }

    [Fact]
    public async Task Verify_OlderVersion_IsSuperseded_AndUnknownVersionIs404()
    {
        var db = CreateInMemoryDb();
        var code = "QR-OLD-V1";
        var visit = await SeedVisitAsync(db, Guid.NewGuid());
        db.Consultations.AddRange(
            Version(visit.AppointmentId, visit.DoctorId, code, 1, ConsultationStatus.Amended),
            Version(visit.AppointmentId, visit.DoctorId, code, 2, ConsultationStatus.Amended));
        await db.SaveChangesAsync();

        var controller = CreateConsultationsController(db);

        var older = await controller.VerifyPrescription(code, 1, CancellationToken.None);
        var olderDoc = JsonSerializer.Deserialize<JsonElement>(
            JsonSerializer.Serialize(Assert.IsType<OkObjectResult>(older).Value));
        Assert.True(olderDoc.GetProperty("isSuperseded").GetBoolean());
        Assert.Equal(1, olderDoc.GetProperty("currentVersion").GetInt32());

        var unknown = await controller.VerifyPrescription(code, 99, CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(unknown);
    }

    [Fact]
    public async Task Verify_ExpiredShareLink_Returns410()
    {
        var db = CreateInMemoryDb();
        var controller = CreateConsultationsController(db, "unit-test-secret");
        var expired = DateTimeOffset.UtcNow.AddMinutes(-1).ToUnixTimeSeconds();

        var result = await controller.VerifyPrescription("QR-LINK", null, CancellationToken.None,
            expired, ShareSig("QR-LINK", expired, "unit-test-secret"));

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(410, obj.StatusCode);
    }

    [Fact]
    public async Task Verify_ForgedShareSignature_Returns400_AndCorrectOnePasses()
    {
        var db = CreateInMemoryDb();
        var code = "QR-LINK-OK";
        var visit = await SeedVisitAsync(db, Guid.NewGuid());
        db.Consultations.Add(Version(visit.AppointmentId, visit.DoctorId, code, 1, ConsultationStatus.Finalized));
        await db.SaveChangesAsync();

        var controller = CreateConsultationsController(db, "unit-test-secret");
        var exp = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds();

        var forged = await controller.VerifyPrescription(code, null, CancellationToken.None, exp, "DEADBEEF");
        Assert.IsType<BadRequestObjectResult>(forged);

        var valid = await controller.VerifyPrescription(code, null, CancellationToken.None,
            exp, ShareSig(code, exp, "unit-test-secret"));
        Assert.IsType<OkObjectResult>(valid);
    }

    [Fact]
    public async Task ShareLink_IsDisabled_WhenSecretIsNotConfigured()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var visit = await SeedVisitAsync(db, tenantId);
        db.PatientConsents.Add(new PatientConsent
        {
            Id = Guid.NewGuid(),
            PatientId = visit.PatientId,
            Purpose = "whatsapp_opt_in"
        });
        var consultation = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = visit.AppointmentId,
            DoctorId = visit.DoctorId,
            Status = ConsultationStatus.Finalized,
            VerificationQrCode = "QR-SHARE"
        };
        db.Consultations.Add(consultation);
        var prescription = new Prescription { Id = Guid.NewGuid(), ConsultationId = consultation.Id };
        db.Prescriptions.Add(prescription);
        await db.SaveChangesAsync();

        var controller = CreateConsultationsController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(visit.DoctorId, tenantId, "Doctor") }
        };

        var result = await controller.GenerateShareLink(prescription.Id, CancellationToken.None);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(503, obj.StatusCode);
    }

    [Fact]
    public async Task SaveDraft_DropsDrugId_ThatIsNotInTheCatalogue()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var patient = new Patient { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Draft Patient", Phone = "9876543210" };
        db.Patients.Add(patient);
        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DoctorId = doctorId,
            PatientId = patient.Id,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "10:00"
        };
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();

        var controller = new ConsultationsController(db, NullLogger<ConsultationsController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(doctorId, tenantId, "Doctor") }
        };

        var openSourceId = Guid.NewGuid(); // deterministic CDCI id with no Drugs row
        var request = new SaveConsultationDraftRequest(
            null, null, "Fever", null, null, null, null, null, null, null, null,
            new List<StructuredPrescriptionItemRequest>
            {
                new(openSourceId, "Paracetamol", "Dolo", "Tablet", "650mg", null, "1-0-1", 5, "Days", null, 10, null, null, true)
            });

        var result = await controller.SaveDraft(appointment.Id, request, CancellationToken.None);
        Assert.IsType<OkObjectResult>(result);

        var item = await db.PrescriptionItems.FirstAsync();
        Assert.Null(item.DrugId);
        Assert.True(item.IsUnverified);
    }

    [Fact]
    public async Task Dispense_MatchesLineByGenericStrengthAndForm_AndWritesRealBatch()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        db.Clinics.Add(new Clinic { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Licensed", PharmacyLicenceNumber20 = "DL-20" });
        var doctor = new User { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Dr. Real", Role = UserRole.Doctor };
        db.Users.Add(doctor);
        var patient = new Patient { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Dispense Patient", Phone = "9876543210" };
        db.Patients.Add(patient);
        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "10:00"
        };
        db.Appointments.Add(appointment);
        var consultation = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = appointment.Id,
            DoctorId = doctor.Id,
            Status = ConsultationStatus.Finalized,
            DoctorRegistrationNumber = "MCI-77"
        };
        db.Consultations.Add(consultation);

        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Dolo 650",
            GenericName = "Paracetamol",
            Strength = "650mg",
            DosageForm = "Tablet"
        };
        db.Drugs.Add(drug);
        var batch = new DrugBatch
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DrugId = drug.Id,
            BatchNumber = "DOLO-B1",
            ExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(8)),
            QuantityReceived = 10,
            QuantityRemaining = 10,
            Mrp = 30m,
            PurchaseRate = 20m
        };
        db.DrugBatches.Add(batch);

        var rx = new Prescription { Id = Guid.NewGuid(), ConsultationId = consultation.Id, CreatedAt = DateTimeOffset.UtcNow };
        var rxItem = new PrescriptionItem
        {
            Id = Guid.NewGuid(),
            PrescriptionId = rx.Id,
            GenericName = "Paracetamol",
            BrandName = "Dolo 650",
            Strength = "650mg",
            DosageForm = "Tablet",
            MedicineText = "Paracetamol 650mg",
            TotalQuantity = 10
        };
        rx.Items.Add(rxItem);
        db.Prescriptions.Add(rx);
        await db.SaveChangesAsync();

        var controller = new PharmacyComplianceController(db, NullLogger<PharmacyComplianceController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Pharmacist") }
        };

        var result = await controller.DispensePrescription(
            new DispensePrescriptionRequest(rx.Id, null, null, null, null, null, null), CancellationToken.None);

        Assert.IsType<ObjectResult>(result);
        Assert.True(rxItem.IsDispensed);
        Assert.Equal(10, rxItem.DispensedQuantity);

        var dispensed = await db.DispenseItems.SingleAsync();
        Assert.Equal(batch.Id, dispensed.DrugBatchId);

        var updatedBatch = await db.DrugBatches.FindAsync(batch.Id);
        Assert.Equal(0, updatedBatch!.QuantityRemaining);
    }

    [Fact]
    public async Task Dispense_BlocksNdps_FromThePrescriptionLine_EvenWithoutCatalogueMatch()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var visit = await SeedVisitAsync(db, tenantId);

        var consultation = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = visit.AppointmentId,
            DoctorId = visit.DoctorId,
            Status = ConsultationStatus.Finalized
        };
        db.Consultations.Add(consultation);

        var rx = new Prescription { Id = Guid.NewGuid(), ConsultationId = consultation.Id };
        rx.Items.Add(new PrescriptionItem
        {
            Id = Guid.NewGuid(),
            PrescriptionId = rx.Id,
            GenericName = "Tramadol",
            MedicineText = "Tramadol 50mg",
            ScheduleClass = ScheduleClass.NDPS
        });
        db.Prescriptions.Add(rx);
        await db.SaveChangesAsync();

        var controller = new PharmacyComplianceController(db, NullLogger<PharmacyComplianceController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Pharmacist") }
        };

        var result = await controller.DispensePrescription(
            new DispensePrescriptionRequest(rx.Id, null, null, null, null, null, null), CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("ndps_digital_dispensing_prohibited", JsonSerializer.Serialize(badRequest.Value));
    }

    [Fact]
    public async Task Substitutes_AreSameGenericStrengthAndForm_AndInStock()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var expiry = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6));

        var original = new Drug
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Name = "Dolo 500",
            GenericName = "Paracetamol", Strength = "500mg", DosageForm = "Tablet"
        };
        var exact = new Drug
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Name = "Paracip 500",
            GenericName = "Paracetamol", Strength = "500mg", DosageForm = "Tablet"
        };
        var otherStrength = new Drug
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Name = "Dolo 650",
            GenericName = "Paracetamol", Strength = "650mg", DosageForm = "Tablet"
        };
        var combination = new Drug
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Name = "Paracetamol + Codeine",
            GenericName = "Paracetamol + Codeine", Strength = "500mg", DosageForm = "Tablet"
        };
        db.Drugs.AddRange(original, exact, otherStrength, combination);

        foreach (var drug in new[] { exact, otherStrength, combination })
        {
            db.DrugBatches.Add(new DrugBatch
            {
                Id = Guid.NewGuid(), TenantId = tenantId, DrugId = drug.Id,
                BatchNumber = $"B-{drug.Name}", ExpiryDate = expiry,
                QuantityReceived = 5, QuantityRemaining = 5, Mrp = 20m, PurchaseRate = 12m
            });
        }
        await db.SaveChangesAsync();

        var controller = new PharmacyCatalogController(db, NullLogger<PharmacyCatalogController>.Instance);
        var result = await controller.GetGenericSubstitutes(original.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var doc = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(ok.Value));
        var substitutes = doc.GetProperty("substitutes");
        Assert.Equal(1, substitutes.GetArrayLength());
        Assert.Equal("Paracip 500", substitutes[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task Recall_ZeroesRemainingQuantity_SoLedgerAndStockAgree()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var drug = new Drug { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Ceftriaxone", GenericName = "Ceftriaxone" };
        db.Drugs.Add(drug);
        var batch = new DrugBatch
        {
            Id = Guid.NewGuid(), TenantId = tenantId, DrugId = drug.Id,
            BatchNumber = "CEF-9", ExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6)),
            QuantityReceived = 50, QuantityRemaining = 50, Mrp = 40m, PurchaseRate = 25m
        };
        db.DrugBatches.Add(batch);
        await db.SaveChangesAsync();

        var controller = new PharmacyBatchController(db, NullLogger<PharmacyBatchController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Pharmacist") }
        };

        var result = await controller.RecallBatch(batch.Id, new BatchRecallRequest("Contamination"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(result);

        var updated = await db.DrugBatches.FindAsync(batch.Id);
        Assert.Equal(0, updated!.QuantityRemaining);

        var movement = await db.DrugStockMovements.SingleAsync(m => m.DrugBatchId == batch.Id);
        Assert.Equal(50, movement.Quantity);
        Assert.Equal("Recall", movement.ReferenceType);
    }

    [Fact]
    public async Task PosCheckout_UsesCatalogueGstRate_NotClientSuppliedOne()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        db.Clinics.Add(new Clinic { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Licensed", PharmacyLicenceNumber20 = "DL-20" });
        var drug = new Drug
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Name = "ORS Sachet",
            GenericName = "Oral Rehydration Salts", GstRate = 5m, HsnCode = "30049099"
        };
        db.Drugs.Add(drug);
        var batch = new DrugBatch
        {
            Id = Guid.NewGuid(), TenantId = tenantId, DrugId = drug.Id,
            BatchNumber = "ORS-1", ExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(9)),
            QuantityReceived = 20, QuantityRemaining = 20, Mrp = 100m, PurchaseRate = 70m
        };
        db.DrugBatches.Add(batch);
        await db.SaveChangesAsync();

        var controller = new PharmacyPosController(
            db, NullLogger<PharmacyPosController>.Instance, new TimezoneService());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Pharmacist") }
        };

        // Client claims 18% GST and a different price; the server must use 5% of the printed MRP.
        var req = new PosCheckoutRequest(
            "Walk-in", "9876543210", null, null, null, null, null, "Cash", 100m, null,
            new List<PosCheckoutItem> { new(drug.Id, batch.Id, 1, 80m, 18m, "3004") });

        var result = await controller.CheckoutPos(req, CancellationToken.None);
        var ok = Assert.IsType<ObjectResult>(result);
        var doc = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(ok.Value));

        Assert.Equal(95.24m, doc.GetProperty("subtotal").GetDecimal());
        Assert.Equal(4.76m, doc.GetProperty("gstAmount").GetDecimal());
        Assert.Equal(100.00m, doc.GetProperty("total").GetDecimal());
        Assert.Equal(5m, doc.GetProperty("items")[0].GetProperty("gstRate").GetDecimal());
    }
}
