using System.Security.Claims;
using Hospital_CRM.Api.Controllers;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hospital_CRM.Tests;

public class ConsultationsControllerTests
{
    private HospitalCrmDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new HospitalCrmDbContext(options);
    }

    private ConsultationsController CreateController(HospitalCrmDbContext db, Guid doctorId)
    {
        var controller = new ConsultationsController(db);
        var claims = new[]
        {
            new Claim("sub", doctorId.ToString()),
            new Claim("role", "Doctor")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }

    [Fact]
    public async Task CreateConsultation_SavesNote_AndCanBeAmended()
    {
        var db = CreateInMemoryDb();
        var doctorId = Guid.NewGuid();
        var clinicId = Guid.NewGuid();

        var doctor = new User
        {
            Id = doctorId,
            Name = "Dr. Test",
            Role = UserRole.Doctor,
            ClinicId = clinicId,
            Email = "dr.test@samstack.ai",
            PasswordHash = "hash"
        };
        db.Users.Add(doctor);

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            Name = "Patient One",
            Phone = "9988776655",
            CreatedBy = doctorId
        };
        db.Patients.Add(patient);

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            PatientId = patient.Id,
            ClinicId = clinicId,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "10:30",
            Status = AppointmentStatus.Completed,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();

        var controller = CreateController(db, doctorId);

        // 1. Initial Consultation (v1)
        var createRequest = new CreateConsultationRequest(
            ChiefComplaint: "Fever and sore throat",
            Observations: "Tonsillar hyperemia",
            Diagnosis: "Acute Pharyngitis",
            PreviousVersionId: null
        );

        var result = await controller.CreateConsultation(appointment.Id, createRequest, CancellationToken.None);
        var createdResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(201, createdResult.StatusCode);

        var savedConsultation = await db.Consultations.FirstOrDefaultAsync(c => c.AppointmentId == appointment.Id);
        Assert.NotNull(savedConsultation);
        Assert.Equal(1, savedConsultation.Version);
        Assert.Equal("Fever and sore throat", savedConsultation.ChiefComplaint);

        // 2. Amend Consultation (v2) - Non-destructive clinical amendment
        var amendRequest = new CreateConsultationRequest(
            ChiefComplaint: "Fever, sore throat, and mild cough",
            Observations: "Tonsillar hyperemia + clear chest",
            Diagnosis: "Acute Viral Pharyngitis",
            PreviousVersionId: savedConsultation.Id
        );

        var amendResult = await controller.AmendConsultation(savedConsultation.Id, amendRequest, CancellationToken.None);
        var amendCreated = Assert.IsType<ObjectResult>(amendResult);
        Assert.Equal(201, amendCreated.StatusCode);

        var allVersions = await db.Consultations.Where(c => c.AppointmentId == appointment.Id).OrderBy(c => c.Version).ToListAsync();
        Assert.Equal(2, allVersions.Count);
        Assert.Equal(1, allVersions[0].Version);
        Assert.Equal(2, allVersions[1].Version);
        Assert.Equal(allVersions[0].Id, allVersions[1].PreviousVersionId);
    }

    [Fact]
    public async Task AddPrescription_AttachesPrescriptionItems()
    {
        var db = CreateInMemoryDb();
        var doctorId = Guid.NewGuid();
        var consultation = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = Guid.NewGuid(),
            DoctorId = doctorId,
            ChiefComplaint = "Cough",
            Diagnosis = "Bronchitis",
            Version = 1,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Consultations.Add(consultation);
        await db.SaveChangesAsync();

        var controller = CreateController(db, doctorId);

        var rxRequest = new AddPrescriptionRequest(new List<PrescriptionItemRequest>
        {
            new("Tab. Azithromycin 500mg", "1 Tab", "OD", "3 Days"),
            new("Syp. CoughRelief", "10ml", "TID", "5 Days")
        });

        var result = await controller.AddPrescription(consultation.Id, rxRequest, CancellationToken.None);
        var createdResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(201, createdResult.StatusCode);

        var prescription = await db.Prescriptions.FirstOrDefaultAsync(p => p.ConsultationId == consultation.Id);
        Assert.NotNull(prescription);

        var items = await db.PrescriptionItems.Where(pi => pi.PrescriptionId == prescription.Id).ToListAsync();
        Assert.Equal(2, items.Count);
    }
}
