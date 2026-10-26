using System.Security.Claims;
using System.Text.Json;
using Hospital_CRM.Api.Controllers;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Api.Services.Typesense;
using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Hospital_CRM.Tests;

public class Section1HardeningTests
{
    private class StubNotification : INotificationService
    {
        public Task SendAppointmentConfirmationAsync(Guid appointmentId, string patientPhone, string clinicName, DateTime dateTime, string? precheckLink = null) => Task.CompletedTask;
        public Task SendAppointmentReminderAsync(Guid appointmentId, string patientPhone, string clinicName, DateTime dateTime, string? precheckLink = null) => Task.CompletedTask;
    }

    private HospitalCrmDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new HospitalCrmDbContext(options);
    }

    private static JsonElement ToJson(object? value)
    {
        var json = JsonSerializer.Serialize(value);
        return JsonDocument.Parse(json).RootElement;
    }

    private (AppointmentsController controller, Guid userId, Guid clinicId) CreateAppointmentsController(HospitalCrmDbContext db, string role = "Receptionist")
    {
        var userId = Guid.NewGuid();
        var clinicId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();

        var inMemorySettings = new Dictionary<string, string?>
        {
            ["App:PublicBaseUrl"] = "http://localhost:5173"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var precheckService = new PrecheckService(db, config);
        var moduleGate = new ModuleGateService(db);

        var controller = new AppointmentsController(db, new StubNotification(), precheckService, new TimezoneService(), moduleGate);
        var claims = new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("role", role),
            new Claim("tenant_id", tenantId.ToString())
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        return (controller, userId, clinicId);
    }

    [Fact]
    public async Task CheckIn_IsIdempotent_AndAssignsPerDoctorCounter()
    {
        var db = CreateInMemoryDb();
        var (controller, userId, clinicId) = CreateAppointmentsController(db);

        var doctorId = Guid.NewGuid();
        var doctor = new User
        {
            Id = doctorId,
            Email = "doctor1@example.com",
            Name = "Dr. Sharma",
            Role = UserRole.Doctor,
            PasswordHash = "hash"
        };
        var clinic = new Clinic
        {
            Id = clinicId,
            Name = "Apollo Multispecialty Clinic"
        };

        var patient1 = new Patient { Id = Guid.NewGuid(), Name = "Aarav Patel", Phone = "9876543210" };
        var patient2 = new Patient { Id = Guid.NewGuid(), Name = "Bhavna Patel", Phone = "9876543211" };

        var apt1 = new Appointment
        {
            Id = Guid.NewGuid(),
            ClinicId = clinicId,
            DoctorId = doctorId,
            PatientId = patient1.Id,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "09:00",
            Status = AppointmentStatus.Booked
        };

        var apt2 = new Appointment
        {
            Id = Guid.NewGuid(),
            ClinicId = clinicId,
            DoctorId = doctorId,
            PatientId = patient2.Id,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "09:30",
            Status = AppointmentStatus.Booked
        };

        db.Patients.AddRange(patient1, patient2);
        db.Users.Add(doctor);
        db.Clinics.Add(clinic);
        db.Appointments.AddRange(apt1, apt2);
        await db.SaveChangesAsync();

        // Check in first appointment
        var result1 = await controller.CheckIn(apt1.Id, CancellationToken.None) as OkObjectResult;
        Assert.NotNull(result1);
        var val1 = ToJson(result1.Value);
        int token1 = val1.GetProperty("queueToken").GetInt32();
        string tracking1 = val1.GetProperty("trackingToken").GetString()!;
        Assert.Equal(1, token1);
        Assert.StartsWith("qtrk_", tracking1);

        // Check in same appointment again (idempotent double-click test)
        var result1Repeat = await controller.CheckIn(apt1.Id, CancellationToken.None) as OkObjectResult;
        Assert.NotNull(result1Repeat);
        var val1Repeat = ToJson(result1Repeat.Value);
        Assert.Equal(1, val1Repeat.GetProperty("queueToken").GetInt32());
        Assert.Equal(tracking1, val1Repeat.GetProperty("trackingToken").GetString());

        // Check in second appointment for same doctor
        var result2 = await controller.CheckIn(apt2.Id, CancellationToken.None) as OkObjectResult;
        Assert.NotNull(result2);
        var val2 = ToJson(result2.Value);
        int token2 = val2.GetProperty("queueToken").GetInt32();
        Assert.Equal(2, token2);
    }

    [Fact]
    public async Task QueueStatus_ExposesOnlyZeroPhi_AndAccuratePosition()
    {
        var db = CreateInMemoryDb();
        var doctorId = Guid.NewGuid();
        var date = DateOnly.FromDateTime(DateTime.UtcNow);

        var apt1 = new Appointment
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            Date = date,
            TimeSlot = "09:00",
            QueueToken = 1,
            QueueTrackingToken = "qtrk_patient_one_token_12345",
            Status = AppointmentStatus.InConsultation
        };

        var apt2 = new Appointment
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            Date = date,
            TimeSlot = "09:30",
            QueueToken = 2,
            QueueTrackingToken = "qtrk_patient_two_token_67890",
            Status = AppointmentStatus.CheckedIn
        };

        db.Appointments.AddRange(apt1, apt2);
        await db.SaveChangesAsync();

        var queueController = new QueueStatusController(db);
        var result = await queueController.GetStatus(apt2.QueueTrackingToken, CancellationToken.None) as OkObjectResult;

        Assert.NotNull(result);
        var val = ToJson(result.Value);
        Assert.Equal(2, val.GetProperty("yourToken").GetInt32());
        Assert.Equal(1, val.GetProperty("currentlyServing").GetInt32());
        Assert.Equal(1, val.GetProperty("position").GetInt32()); // Next up!
        Assert.Equal(0, val.GetProperty("estimatedWaitMinutes").GetInt32());

        // Verify JSON response has ZERO patient identity fields
        var json = System.Text.Json.JsonSerializer.Serialize(result.Value);
        Assert.DoesNotContain("Patient", json);
        Assert.DoesNotContain("Dr.", json);
        Assert.DoesNotContain("Phone", json);
    }

    [Fact]
    public async Task AppointmentStateMachine_EnforcesValidAndTerminalTransitions()
    {
        var db = CreateInMemoryDb();
        var (controller, userId, clinicId) = CreateAppointmentsController(db);

        var apt = new Appointment
        {
            Id = Guid.NewGuid(),
            ClinicId = clinicId,
            DoctorId = Guid.NewGuid(),
            PatientId = Guid.NewGuid(),
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "10:00",
            Status = AppointmentStatus.Booked
        };
        db.Appointments.Add(apt);
        await db.SaveChangesAsync();

        // 1. Booked -> Confirmed (Allowed)
        var res1 = await controller.Update(apt.Id, new UpdateAppointmentRequest("confirmed"), CancellationToken.None) as OkObjectResult;
        Assert.NotNull(res1);
        Assert.Equal("confirmed", ToJson(res1.Value).GetProperty("status").GetString());

        // 2. Confirmed -> CheckedIn (Allowed)
        var res2 = await controller.Update(apt.Id, new UpdateAppointmentRequest("checked_in"), CancellationToken.None) as OkObjectResult;
        Assert.NotNull(res2);
        Assert.Equal("checked_in", ToJson(res2.Value).GetProperty("status").GetString());

        // 3. CheckedIn -> InNursing (Allowed)
        var res3 = await controller.Update(apt.Id, new UpdateAppointmentRequest("in_nursing"), CancellationToken.None) as OkObjectResult;
        Assert.NotNull(res3);
        Assert.Equal("in_nursing", ToJson(res3.Value).GetProperty("status").GetString());

        // 4. InNursing -> InConsultation (Allowed)
        var res4 = await controller.Update(apt.Id, new UpdateAppointmentRequest("in_consultation"), CancellationToken.None) as OkObjectResult;
        Assert.NotNull(res4);
        Assert.Equal("in_consultation", ToJson(res4.Value).GetProperty("status").GetString());

        // 5. InConsultation -> Completed (Allowed)
        var res5 = await controller.Update(apt.Id, new UpdateAppointmentRequest("completed"), CancellationToken.None) as OkObjectResult;
        Assert.NotNull(res5);
        Assert.Equal("completed", ToJson(res5.Value).GetProperty("status").GetString());

        // 6. Completed -> Booked (Illegal transition from terminal state -> 400 Bad Request)
        var badRes = await controller.Update(apt.Id, new UpdateAppointmentRequest("booked"), CancellationToken.None) as BadRequestObjectResult;
        Assert.NotNull(badRes);
        var badVal = ToJson(badRes.Value);
        Assert.Equal("invalid_status_transition", badVal.GetProperty("error").GetString());
    }

    [Fact]
    public async Task PatientRegistration_GeneratesUhid_AndAllowsFamilySharingPhone()
    {
        var db = CreateInMemoryDb();
        var userId = Guid.NewGuid();
        var patientsController = new PatientsController(db, new FakePatientSearchService());

        var claims = new[]
        {
            new Claim("sub", userId.ToString()),
            new Claim("role", "Receptionist"),
            new Claim("tenant_id", Guid.NewGuid().ToString())
        };
        patientsController.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        // Register family member 1 (e.g. Parent)
        var req1 = new PatientRegisterRequest(
            Name: "Rajesh Kumar",
            Phone: "9876543210",
            Dob: new DateOnly(1980, 5, 10),
            ApproxAge: 44,
            Gender: "male",
            Address: "123 MG Road, Bengaluru",
            Consent: new ConsentRequest(true, "direct_care"),
            IdempotencyKey: $"IDEMP-PAT-{Guid.NewGuid()}",
            WhatsAppOptIn: true
        );

        var res1 = await patientsController.Register(req1, CancellationToken.None) as ObjectResult;
        Assert.NotNull(res1);
        Assert.Equal(201, res1.StatusCode);
        var p1 = ToJson(res1.Value);
        string uhid1 = p1.GetProperty("uhid").GetString()!;
        Assert.StartsWith("UHID-", uhid1);

        // Attempting to register child with same phone without confirmation returns warning
        var req2Unconfirmed = new PatientRegisterRequest(
            Name: "Aarav Kumar",
            Phone: "9876543210",
            Dob: new DateOnly(2015, 8, 20),
            ApproxAge: 9,
            Gender: "male",
            Address: "123 MG Road, Bengaluru",
            Consent: new ConsentRequest(true, "direct_care"),
            IdempotencyKey: $"IDEMP-PAT-{Guid.NewGuid()}",
            WhatsAppOptIn: false,
            ConfirmDifferentPersonOnSamePhone: false
        );

        var res2Unconfirmed = await patientsController.Register(req2Unconfirmed, CancellationToken.None) as OkObjectResult;
        Assert.NotNull(res2Unconfirmed);
        var unconfirmedVal = ToJson(res2Unconfirmed.Value);
        Assert.True(unconfirmedVal.GetProperty("sharedPhoneDetected").GetBoolean());

        // Register child with confirmDifferentPersonOnSamePhone: true succeeds and creates distinct patient with distinct UHID
        var req2Confirmed = req2Unconfirmed with { ConfirmDifferentPersonOnSamePhone = true };
        var res2 = await patientsController.Register(req2Confirmed, CancellationToken.None) as ObjectResult;
        Assert.NotNull(res2);
        Assert.Equal(201, res2.StatusCode);
        var p2 = ToJson(res2.Value);
        string uhid2 = p2.GetProperty("uhid").GetString()!;
        Assert.StartsWith("UHID-", uhid2);
        Assert.NotEqual(uhid1, uhid2);

        // Verify Consents in DB
        var patient1Db = await db.Patients.Include(p => p.Consents).FirstAsync(p => p.Name == "Rajesh Kumar");
        Assert.Equal(2, patient1Db.Consents.Count); // Treatment consent + WhatsApp opt-in consent
        Assert.Contains(patient1Db.Consents, c => c.Purpose == "whatsapp_opt_in");

        // Test consent withdrawal
        var whatsappConsent = patient1Db.Consents.First(c => c.Purpose == "whatsapp_opt_in");
        var withdrawRes = await patientsController.WithdrawConsent(patient1Db.Id, whatsappConsent.Id, CancellationToken.None) as OkObjectResult;
        Assert.NotNull(withdrawRes);
        var consentAfter = await db.PatientConsents.FindAsync(whatsappConsent.Id);
        Assert.NotNull(consentAfter?.WithdrawnAt);
    }

    [Fact]
    public async Task PatientSearch_RequiresMinQueryLength()    {
        var db = CreateInMemoryDb();
        var patientsController = new PatientsController(db, new FakePatientSearchService());

        var claims = new[]
        {
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("role", "Receptionist"),
            new Claim("tenant_id", Guid.NewGuid().ToString())
        };
        patientsController.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        // Query with 1 character should be rejected with 400 Bad Request
        var badRes = await patientsController.Search("a", CancellationToken.None) as BadRequestObjectResult;
        Assert.NotNull(badRes);
        var badVal = ToJson(badRes.Value);
        Assert.Equal("query_too_short_min_2_chars", badVal.GetProperty("error").GetString());
    }

    [Fact]
    public async Task QueueStatus_Rejects_Guessable_Numeric_Token()
    {
        var db = CreateInMemoryDb();
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(),
            DoctorId = Guid.NewGuid(),
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            TimeSlot = "09:00",
            QueueToken = 1,
            Status = AppointmentStatus.CheckedIn
        });
        await db.SaveChangesAsync();

        var result = await new QueueStatusController(db).GetStatus("1", CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task PatientRegistration_Issues_Sequential_Uhid()
    {
        var db = CreateInMemoryDb();
        var controller = new PatientsController(db, new FakePatientSearchService());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim("sub", Guid.NewGuid().ToString()),
                    new Claim("role", "Receptionist"),
                    new Claim("tenant_id", Guid.NewGuid().ToString())
                }, "TestAuth"))
            }
        };

        async Task<string> Register(string name, string phone)
        {
            var result = await controller.Register(new PatientRegisterRequest(
                Name: name,
                Phone: phone,
                Dob: new DateOnly(1990, 1, 1),
                ApproxAge: null,
                Gender: "male",
                Address: null,
                Consent: new ConsentRequest(true, "direct_care"),
                IdempotencyKey: $"IDEMP-PAT-{Guid.NewGuid()}",
                WhatsAppOptIn: false), CancellationToken.None);

            var ok = Assert.IsType<ObjectResult>(result);
            Assert.Equal(201, ok.StatusCode);
            return ToJson(ok.Value).GetProperty("uhid").GetString()!;
        }

        var first = await Register("Anil Verma", "9811111111");
        var second = await Register("Sunita Verma", "9822222222");

        Assert.EndsWith("-0001", first);
        Assert.EndsWith("-0002", second);
    }

    [Fact]
    public async Task Reschedule_RejectsOccupiedSlot_And_TerminalAppointment()
    {
        var db = CreateInMemoryDb();
        var (controller, _, clinicId) = CreateAppointmentsController(db);
        var doctorId = Guid.NewGuid();

        var target = new Appointment
        {
            Id = Guid.NewGuid(), ClinicId = clinicId, DoctorId = doctorId, PatientId = Guid.NewGuid(),
            Date = new DateOnly(2026, 11, 2), TimeSlot = "09:00", Status = AppointmentStatus.Booked
        };
        var occupying = new Appointment
        {
            Id = Guid.NewGuid(), ClinicId = clinicId, DoctorId = doctorId, PatientId = Guid.NewGuid(),
            Date = new DateOnly(2026, 11, 3), TimeSlot = "10:00", Status = AppointmentStatus.Booked
        };
        var cancelled = new Appointment
        {
            Id = Guid.NewGuid(), ClinicId = clinicId, DoctorId = doctorId, PatientId = Guid.NewGuid(),
            Date = new DateOnly(2026, 11, 4), TimeSlot = "11:00", Status = AppointmentStatus.Cancelled
        };
        db.Appointments.AddRange(target, occupying, cancelled);
        await db.SaveChangesAsync();

        var conflict = await controller.Reschedule(target.Id,
            new RescheduleAppointmentRequest("2026-11-03", "10:00"), CancellationToken.None);
        Assert.IsType<ConflictObjectResult>(conflict);

        var terminal = await controller.Reschedule(cancelled.Id,
            new RescheduleAppointmentRequest("2026-11-05", "12:00"), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(terminal);
    }

    [Fact]
    public async Task Nurse_CanMoveThroughNursing_ButNotComplete()
    {
        var db = CreateInMemoryDb();
        var (controller, _, clinicId) = CreateAppointmentsController(db, "Nurse");
        var appointment = new Appointment
        {
            Id = Guid.NewGuid(), ClinicId = clinicId, DoctorId = Guid.NewGuid(), PatientId = Guid.NewGuid(),
            Date = DateOnly.FromDateTime(DateTime.UtcNow), TimeSlot = "09:00", Status = AppointmentStatus.CheckedIn
        };
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();

        var toNursing = await controller.Update(appointment.Id, new UpdateAppointmentRequest("in_nursing"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(toNursing);

        var complete = await controller.Update(appointment.Id, new UpdateAppointmentRequest("completed"), CancellationToken.None) as ObjectResult;
        Assert.NotNull(complete);
        Assert.Equal(403, complete.StatusCode);
    }

    [Fact]
    public async Task Receptionist_Emergency_Triage_RequiresStructuredCode()
    {
        var db = CreateInMemoryDb();
        var (controller, _, clinicId) = CreateAppointmentsController(db);
        var appointment = new Appointment
        {
            Id = Guid.NewGuid(), ClinicId = clinicId, DoctorId = Guid.NewGuid(), PatientId = Guid.NewGuid(),
            Date = DateOnly.FromDateTime(DateTime.UtcNow), TimeSlot = "09:00", Status = AppointmentStatus.Booked
        };
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();

        var freeTextOnly = await controller.UpdatePriority(appointment.Id,
            new UpdatePriorityRequest("emergency", "this is long enough text", null, false), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(freeTextOnly);

        var coded = await controller.UpdatePriority(appointment.Id,
            new UpdatePriorityRequest("emergency", null, "chest_pain", false), CancellationToken.None) as OkObjectResult;
        Assert.NotNull(coded);
        var body = ToJson(coded.Value);
        Assert.Equal("chest_pain", body.GetProperty("triageReasonCode").GetString());
        Assert.Equal("Critical emergency condition suspected. Immediate hospital ER referral recommended.",
            body.GetProperty("hospitalReferralAdvisory").GetString());
    }

    [Theory]
    [InlineData(UserRole.Nurse, true)]
    [InlineData(UserRole.Pharmacist, false)]
    public void PatientsRead_Permission_IsGranted_ToClinicalRoles(UserRole role, bool expected)
    {
        Assert.Equal(expected, Permissions.RoleHasPermission(role, Permissions.PatientsRead));
    }
}
