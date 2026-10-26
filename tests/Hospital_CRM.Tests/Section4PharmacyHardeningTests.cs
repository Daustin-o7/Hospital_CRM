using System.Security.Claims;
using System.Text.Json;
using Hospital_CRM.Api.Controllers;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Hospital_CRM.Tests;

public class Section4PharmacyHardeningTests
{
    private static HospitalCrmDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(databaseName: $"Sec4Db_{Guid.NewGuid()}")
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

    [Fact]
    public async Task CDCI_Fallback_Marks_Result_As_Unverified_OpenSource()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var searchService = new MockMedicineSearchService(new List<Hospital_CRM.Api.Services.Typesense.MedicineSearchHit>()); // 0 local hits
        var cdciResults = new List<CdciMedicineSearchResult>
        {
            new(
                ExternalCode: "784977002",
                Name: "Safedox 200mg",
                GenericName: "Cefpodoxime Proxetil 200mg",
                DosageForm: "Tablet",
                Strength: "200mg",
                CommonBrands: "Safedox",
                DataSource: "CDCI (Open Source)",
                IsUnverified: true,
                CheckpointMessage: "Open Source - Needs Pharmacist Review"
            )
        };
        var cdciService = new MockCdciMedicineCatalogService(cdciResults);

        var controller = new MedicinesController(db, searchService, cdciService, NullLogger<MedicinesController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Doctor") }
        };

        var result = await controller.Search("safedox", 10, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        var items = JsonSerializer.Deserialize<List<JsonElement>>(json)!;

        Assert.Single(items);
        Assert.Equal("Safedox 200mg", items[0].GetProperty("name").GetString());
        Assert.True(items[0].GetProperty("isUnverified").GetBoolean());
        Assert.Equal("CDCI (Open Source)", items[0].GetProperty("dataSource").GetString());
        Assert.Equal("Open Source - Needs Pharmacist Review", items[0].GetProperty("checkpointMessage").GetString());
    }

    [Fact]
    public async Task Search_Logs_Miss_When_Zero_Hits()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var searchService = new MockMedicineSearchService(new List<Hospital_CRM.Api.Services.Typesense.MedicineSearchHit>());
        var cdciService = new MockCdciMedicineCatalogService(new List<CdciMedicineSearchResult>());

        var controller = new MedicinesController(db, searchService, cdciService, NullLogger<MedicinesController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Doctor") }
        };

        var result = await controller.Search("NonExistentMedicineX99", 10, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);

        var missLogs = await db.MedicineSearchMissLogs.ToListAsync();
        Assert.Single(missLogs);
        Assert.Equal("NonExistentMedicineX99", missLogs[0].Query);
        Assert.Equal(userId, missLogs[0].SearchedByUserId);
    }

    [Fact]
    public async Task StockIn_Appends_To_StockMovement_Ledger()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Amoxicillin 500mg",
            GenericName = "Amoxicillin",
            ScheduleClass = ScheduleClass.ScheduleH1
        };
        db.Drugs.Add(drug);
        await db.SaveChangesAsync();

        var controller = new PharmacyBatchController(db, NullLogger<PharmacyBatchController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Pharmacist") }
        };

        var req = new StockInRequest(
            DrugId: drug.Id,
            SupplierId: null,
            SupplierInvoiceNumber: "INV-9988",
            SupplierLicenceNumber: "SUPP-DL-44",
            BatchNumber: "AMX-B1",
            ExpiryDate: "2027-12-31",
            MfgDate: "2026-01-01",
            QuantityReceived: 500,
            Mrp: 120m,
            PurchaseRate: 75m,
            PackSize: "10 Strips",
            BaseUnitQuantity: 10
        );

        var result = await controller.StockIn(req, CancellationToken.None);
        Assert.IsType<ObjectResult>(result);

        var movements = await db.DrugStockMovements.ToListAsync();
        Assert.Single(movements);
        Assert.Equal(drug.Id, movements[0].DrugId);
        Assert.Equal(500, movements[0].Quantity);
        Assert.Equal(MovementDirection.In, movements[0].Direction);
        Assert.Equal("StockIn", movements[0].ReferenceType);
        Assert.Equal(userId, movements[0].RecordedBy);
    }

    [Fact]
    public async Task Dispensing_Blocks_When_Clinic_Lacks_Form20_Or_21_Licence()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var clinic = new Clinic
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Unlicensed Clinic",
            PharmacyLicenceNumber20 = null,
            PharmacyLicenceNumber21 = null
        };
        db.Clinics.Add(clinic);
        await db.SaveChangesAsync();

        var controller = new PharmacyComplianceController(db, NullLogger<PharmacyComplianceController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Pharmacist") }
        };

        var req = new DispensePrescriptionRequest(Guid.NewGuid(), null, null, null, null, null, null);
        var result = await controller.DispensePrescription(req, CancellationToken.None);

        var objResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, objResult.StatusCode);
    }

    [Fact]
    public async Task Dispensing_HardBlocks_NDPS_Medications()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var clinic = new Clinic
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Licensed Clinic",
            PharmacyLicenceNumber20 = "DL-20-VALID"
        };
        db.Clinics.Add(clinic);

        var doctor = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Dr. Test",
            Role = UserRole.Doctor
        };
        db.Users.Add(doctor);

        var patient = new Patient { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Test Patient", Phone = "9876543210" };
        db.Patients.Add(patient);

        var appt = new Appointment { Id = Guid.NewGuid(), TenantId = tenantId, DoctorId = doctor.Id, PatientId = patient.Id, Date = DateOnly.FromDateTime(DateTime.UtcNow), TimeSlot = "10:00" };
        db.Appointments.Add(appt);

        var consult = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = appt.Id,
            DoctorId = doctor.Id,
            Status = ConsultationStatus.Finalized
        };
        db.Consultations.Add(consult);

        var rx = new Prescription { Id = Guid.NewGuid(), ConsultationId = consult.Id };
        var rxItem = new PrescriptionItem
        {
            Id = Guid.NewGuid(),
            PrescriptionId = rx.Id,
            MedicineText = "Morphine Sulphate 10mg",
            GenericName = "Morphine Sulphate",
            ScheduleClass = ScheduleClass.NDPS
        };
        rx.Items.Add(rxItem);
        db.Prescriptions.Add(rx);

        var ndpsDrug = new Drug
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Morphine Sulphate 10mg",
            GenericName = "Morphine Sulphate",
            ScheduleClass = ScheduleClass.NDPS
        };
        db.Drugs.Add(ndpsDrug);
        await db.SaveChangesAsync();

        var controller = new PharmacyComplianceController(db, NullLogger<PharmacyComplianceController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Pharmacist") }
        };

        var req = new DispensePrescriptionRequest(rx.Id, "Test Patient", "Clinic St", "Dr. Test", "MCI-1234", null, null);
        var result = await controller.DispensePrescription(req, CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var json = JsonSerializer.Serialize(badRequest.Value);
        Assert.Contains("ndps_digital_dispensing_prohibited", json);
    }

    [Fact]
    public async Task Dispensing_Rejects_Different_Generic_Substitution()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var clinic = new Clinic { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Licensed Clinic", PharmacyLicenceNumber20 = "DL-20-VALID" };
        db.Clinics.Add(clinic);

        var doctor = new User { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Dr. Test", Role = UserRole.Doctor };
        db.Users.Add(doctor);

        var patient = new Patient { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Test Patient", Phone = "9876543210" };
        db.Patients.Add(patient);

        var appt = new Appointment { Id = Guid.NewGuid(), TenantId = tenantId, DoctorId = doctor.Id, PatientId = patient.Id, Date = DateOnly.FromDateTime(DateTime.UtcNow), TimeSlot = "10:00" };
        db.Appointments.Add(appt);

        var consult = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = appt.Id,
            DoctorId = doctor.Id,
            Status = ConsultationStatus.Finalized
        };
        db.Consultations.Add(consult);

        var rx = new Prescription { Id = Guid.NewGuid(), ConsultationId = consult.Id };
        var rxItem = new PrescriptionItem
        {
            Id = Guid.NewGuid(),
            PrescriptionId = rx.Id,
            MedicineText = "Paracetamol 500mg",
            GenericName = "Paracetamol"
        };
        rx.Items.Add(rxItem);
        db.Prescriptions.Add(rx);

        var paracetamol = new Drug { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Paracetamol 500mg", GenericName = "Paracetamol" };
        var ibuprofen = new Drug { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Ibuprofen 400mg", GenericName = "Ibuprofen" };
        db.Drugs.AddRange(paracetamol, ibuprofen);
        await db.SaveChangesAsync();

        var controller = new PharmacyComplianceController(db, NullLogger<PharmacyComplianceController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Pharmacist") }
        };

        var selection = new DispenseItemSelection(rxItem.Id, null, 1, ibuprofen.Id, "Out of paracetamol, trying ibuprofen");
        var req = new DispensePrescriptionRequest(rx.Id, "Patient", "Address", "Dr. Doc", "MCI-1", null, new List<DispenseItemSelection> { selection });

        var result = await controller.DispensePrescription(req, CancellationToken.None);
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var json = JsonSerializer.Serialize(badRequest.Value);
        Assert.Contains("substitution_generic_mismatch", json);
    }

    [Fact]
    public async Task PosCheckout_Calculates_Reverse_GST_From_MRP()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var clinic = new Clinic { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Licensed Clinic", PharmacyLicenceNumber20 = "DL-20-VALID" };
        db.Clinics.Add(clinic);

        var drug = new Drug { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Dolo 650", GenericName = "Paracetamol", ScheduleClass = ScheduleClass.General };
        db.Drugs.Add(drug);

        var batch = new DrugBatch
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DrugId = drug.Id,
            BatchNumber = "B-DOLO-01",
            ExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(10)),
            QuantityReceived = 100,
            QuantityRemaining = 100,
            Mrp = 112m, // Customer pays ₹112 MRP per strip
            PurchaseRate = 80m
        };
        db.DrugBatches.Add(batch);
        await db.SaveChangesAsync();

        var timezoneService = new TimezoneService();
        var controller = new PharmacyPosController(db, NullLogger<PharmacyPosController>.Instance, timezoneService);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Pharmacist") }
        };

        // Customer buys 1 strip at MRP ₹112 with 12% GST rate
        // Taxable = 112 / (1 + 0.12) = 100
        // GST = 12
        // Total = 112
        var items = new List<PosCheckoutItem>
        {
            new(drug.Id, batch.Id, 1, 112m, 12m, "3004")
        };
        var req = new PosCheckoutRequest("Walk-in", "9876543210", null, null, null, null, null, "Cash", 112m, null, items);

        var result = await controller.CheckoutPos(req, CancellationToken.None);
        var objResult = Assert.IsType<ObjectResult>(result);
        var json = JsonSerializer.Serialize(objResult.Value);
        var doc = JsonSerializer.Deserialize<JsonElement>(json);

        Assert.Equal(100.00m, doc.GetProperty("subtotal").GetDecimal());
        Assert.Equal(12.00m, doc.GetProperty("gstAmount").GetDecimal());
        Assert.Equal(112.00m, doc.GetProperty("total").GetDecimal());

        // Batch stock deducted
        var updatedBatch = await db.DrugBatches.FindAsync(batch.Id);
        Assert.Equal(99, updatedBatch!.QuantityRemaining);

        // Movement ledger row created
        var movement = await db.DrugStockMovements.FirstOrDefaultAsync(m => m.DrugBatchId == batch.Id);
        Assert.NotNull(movement);
        Assert.Equal(1, movement.Quantity);
        Assert.Equal(MovementDirection.Out, movement.Direction);
    }

    [Fact]
    public async Task PrintPrescription_Logs_PrintCount_And_Stamps_Duplicate_Watermark()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var clinic = new Clinic { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Print Test Clinic" };
        db.Clinics.Add(clinic);

        var doctor = new User { Id = userId, TenantId = tenantId, Name = "Dr. Print", Role = UserRole.Doctor };
        db.Users.Add(doctor);

        var patient = new Patient { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Print Patient", Phone = "9876543210" };
        db.Patients.Add(patient);

        var appt = new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ClinicId = clinic.Id,
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "10:00"
        };
        db.Appointments.Add(appt);

        var consult = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = appt.Id,
            DoctorId = doctor.Id,
            Status = ConsultationStatus.Finalized,
            Version = 1,
            VerificationQrCode = "QR-PRINT-TEST-123"
        };
        db.Consultations.Add(consult);

        var rx = new Prescription { Id = Guid.NewGuid(), ConsultationId = consult.Id };
        db.Prescriptions.Add(rx);
        await db.SaveChangesAsync();

        var controller = new ConsultationsController(db, NullLogger<ConsultationsController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateUserPrincipal(userId, tenantId, "Doctor") }
        };

        // First print -> Original (not duplicate)
        var print1 = await controller.PrintPrescription(rx.Id, CancellationToken.None);
        var ok1 = Assert.IsType<OkObjectResult>(print1);
        var json1 = JsonSerializer.Serialize(ok1.Value);
        var doc1 = JsonSerializer.Deserialize<JsonElement>(json1);
        Assert.False(doc1.GetProperty("isDuplicateCopy").GetBoolean());
        Assert.Equal(1, doc1.GetProperty("printCount").GetInt32());

        // Second print -> DUPLICATE COPY
        var print2 = await controller.PrintPrescription(rx.Id, CancellationToken.None);
        var ok2 = Assert.IsType<OkObjectResult>(print2);
        var json2 = JsonSerializer.Serialize(ok2.Value);
        var doc2 = JsonSerializer.Deserialize<JsonElement>(json2);
        Assert.True(doc2.GetProperty("isDuplicateCopy").GetBoolean());
        Assert.Equal(2, doc2.GetProperty("printCount").GetInt32());
        Assert.Equal("DUPLICATE COPY", doc2.GetProperty("watermark").GetString());

        // Audit logs preserved
        var logs = await db.PrescriptionPrintLogs.Where(l => l.PrescriptionId == rx.Id).ToListAsync();
        Assert.Equal(2, logs.Count);
    }

    [Fact]
    public async Task VerifyPrescription_Identifies_Superseded_Amended_Prescription()
    {
        var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var apptId = Guid.NewGuid();

        var clinic = new Clinic { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Verify Clinic" };
        db.Clinics.Add(clinic);

        var patient = new Patient { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Verify Patient", Phone = "9876543210" };
        db.Patients.Add(patient);

        var doctor = new User { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Dr. Verify", Role = UserRole.Doctor };
        db.Users.Add(doctor);

        var appt = new Appointment
        {
            Id = apptId,
            TenantId = tenantId,
            ClinicId = clinic.Id,
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "10:00"
        };
        db.Appointments.Add(appt);

        var consultV1 = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = apptId,
            DoctorId = doctor.Id,
            Version = 1,
            Status = ConsultationStatus.Amended,
            VerificationQrCode = "QR-SUPERSEDED-TEST",
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-2)
        };

        var consultV2 = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = apptId,
            DoctorId = doctor.Id,
            Version = 2,
            Status = ConsultationStatus.Finalized,
            VerificationQrCode = "QR-SUPERSEDED-TEST",
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.Consultations.AddRange(consultV1, consultV2);
        await db.SaveChangesAsync();

        var controller = new ConsultationsController(db, NullLogger<ConsultationsController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        // When scanned with version 1 parameter
        var result = await controller.VerifyPrescription("QR-SUPERSEDED-TEST", 1, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(ok.Value);
        var doc = JsonSerializer.Deserialize<JsonElement>(json);

        Assert.True(doc.GetProperty("isSuperseded").GetBoolean());
        Assert.Equal("superseded", doc.GetProperty("status").GetString());
        Assert.Equal(2, doc.GetProperty("latestVersion").GetInt32());
        Assert.Contains("superseded", doc.GetProperty("statusDescription").GetString(), StringComparison.OrdinalIgnoreCase);
    }
}
