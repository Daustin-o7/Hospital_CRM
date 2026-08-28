using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Middlewares;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// EF Core
builder.Services.AddDbContext<HospitalCrmDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
           .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

builder.Services.AddMemoryCache();

// Register RSA Key Service for RS256 JWT Asymmetric Signing & JWKS (BUG-030)
builder.Services.AddSingleton<IRsaKeyService, RsaKeyService>();

// JWT Startup Validation & RS256 Setup (BUG-002, BUG-003, BUG-030)
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];

if (string.IsNullOrWhiteSpace(jwtIssuer))
{
    if (builder.Environment.IsDevelopment()) jwtIssuer = "Hospital_CRM";
    else throw new InvalidOperationException("Jwt:Issuer configuration is missing.");
}

if (string.IsNullOrWhiteSpace(jwtAudience))
{
    if (builder.Environment.IsDevelopment()) jwtAudience = "Hospital_CRM";
    else throw new InvalidOperationException("Jwt:Audience configuration is missing.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // The RSA keys are shared as static inside RsaKeyService, so any
        // instance resolves to the same public key for validation as
        // AuthController uses for signing.
        var rsaKeyService = new RsaKeyService(builder.Configuration);
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = rsaKeyService.GetPublicKey(),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOrDoctor", p =>
        p.Requirements.Add(new RbacRequirement("ClinicAdmin", "Doctor")));
    options.AddPolicy("AdminOrReceptionist", p =>
        p.Requirements.Add(new RbacRequirement("ClinicAdmin", "Receptionist")));
    options.AddPolicy("AllRoles", p =>
        p.Requirements.Add(new RbacRequirement("ClinicAdmin", "Doctor", "Receptionist")));
});

builder.Services.AddSingleton<IAuthorizationHandler, RbacHandler>();

// CORS for React frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "https://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// FR-20/21: Notification services
builder.Services.AddSingleton<INotificationService, StubNotificationService>();
builder.Services.AddHostedService<ReminderSchedulerService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    var eraseOnStartup = app.Configuration.GetValue<bool>("Database:EraseOnStartup");
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<HospitalCrmDbContext>();

    if (eraseOnStartup)
    {
        Log.Information("Erasing development database...");
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
        await SeedDevelopmentDataAsync(db);
    }
    else if (!await db.Users.AnyAsync())
    {
        Log.Information("Seeding initial development data...");
        await db.Database.MigrateAsync();
        await SeedDevelopmentDataAsync(db);
    }

    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<InactivityMiddleware>();
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

app.Run();

static async Task SeedDevelopmentDataAsync(HospitalCrmDbContext db)
{
    var clinic = new Clinic
    {
        Id = Guid.NewGuid(),
        Name = "Demo Health Clinic",
        TenantId = Guid.Empty,
        CreatedAt = DateTimeOffset.UtcNow
    };
    db.Clinics.Add(clinic);

    var admin = new User
    {
        Id = Guid.NewGuid(),
        Email = "admin@samstack.ai",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword("AdminPass123!"),
        Name = "Dr. Admin",
        Role = UserRole.ClinicAdmin,
        ClinicId = clinic.Id,
        TenantId = Guid.Empty,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
    db.Users.Add(admin);

    var doctor = new User
    {
        Id = Guid.NewGuid(),
        Email = "doctor@samstack.ai",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword("DoctorPass123!"),
        Name = "Dr. Sharma",
        Role = UserRole.Doctor,
        ClinicId = clinic.Id,
        TenantId = Guid.Empty,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
    db.Users.Add(doctor);

    var receptionist = new User
    {
        Id = Guid.NewGuid(),
        Email = "reception@samstack.ai",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword("ReceptPass123!"),
        Name = "Ms. Reception",
        Role = UserRole.Receptionist,
        ClinicId = clinic.Id,
        TenantId = Guid.Empty,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
    db.Users.Add(receptionist);

    // Seed: configure all 7 days (Monday=1, Tuesday=2, ..., Sunday=0).
    // Sunday is a first-class configurable day (may be open or closed per clinic).
    var days = new Dictionary<string, int>
    {
        { "Monday", 1 }, { "Tuesday", 2 }, { "Wednesday", 3 },
        { "Thursday", 4 }, { "Friday", 5 }, { "Saturday", 6 },
        { "Sunday", 0 }
    };
    foreach (var kvp in days)
    {
        // Open: 09:00–18:00, with a 13:00–14:00 split-shift gap.
        // Admin can edit any of this from Settings.
        db.ClinicHours.Add(new ClinicHours
        {
            Id = Guid.NewGuid(),
            ClinicId = clinic.Id,
            DayOfWeek = kvp.Value,
            ShiftIndex = 0,
            OpenTime = "09:00",
            CloseTime = "13:00",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.ClinicHours.Add(new ClinicHours
        {
            Id = Guid.NewGuid(),
            ClinicId = clinic.Id,
            DayOfWeek = kvp.Value,
            ShiftIndex = 1,
            OpenTime = "14:00",
            CloseTime = "18:00",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }

    // Configure the new clinic fields with sensible defaults
    clinic.Timezone = "UTC";
    clinic.Currency = "INR";
    clinic.DateFormat = "yyyy-MM-dd";
    clinic.TimeFormat = "HH:mm";
    clinic.Language = "en";
    clinic.PrimaryColor = "#0d9488";
    clinic.SecondaryColor = "#1e40af";
    clinic.AccentColor = "#f59e0b";
    clinic.DefaultAppointmentDurationMinutes = 30;
    clinic.BufferMinutes = 0;
    clinic.MinAdvanceBookingHours = 0;
    clinic.MaxAdvanceBookingDays = 90;
    clinic.SameDayBookingAllowed = true;
    clinic.WalkInsAllowed = true;
    clinic.OverbookingAllowed = false;
    clinic.CancellationWindowHours = 24;
    clinic.ReschedulingAllowed = true;
    clinic.NoShowHandlingEnabled = true;
    clinic.QueueEnabled = true;
    clinic.TokenFormat = "D{0:000}";
    clinic.TokenStartNumber = 1;
    clinic.TokenResetFrequency = "daily";
    clinic.InvoicePrefix = "INV";
    clinic.DefaultConsultationFee = 0m;
    clinic.DefaultGstRate = 18.0m;
    clinic.DefaultInvoiceStatus = false;
    clinic.UpdatedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync();

    var patients = new[]
    {
        new { Name = "John Doe", Phone = "+91 98765 43210", Dob = new DateOnly(1990, 5, 15), Gender = Gender.Male, Address = "123 Main St, Mumbai" },
        new { Name = "Jane Smith", Phone = "+91 87654 32109", Dob = new DateOnly(1985, 8, 22), Gender = Gender.Female, Address = "456 Park Ave, Delhi" },
        new { Name = "Robert Johnson", Phone = "+91 76543 21098", Dob = new DateOnly(1992, 11, 3), Gender = Gender.Male, Address = "789 Lake Rd, Bangalore" },
        new { Name = "Emily Davis", Phone = "+91 65432 10987", Dob = new DateOnly(1988, 3, 18), Gender = Gender.Female, Address = "321 Hill View, Chennai" },
        new { Name = "Michael Wilson", Phone = "+91 54321 09876", Dob = new DateOnly(1995, 7, 25), Gender = Gender.Male, Address = "555 River Bank, Hyderabad" }
    };

    foreach (var p in patients)
    {
        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            Name = p.Name,
            Phone = p.Phone,
            DobHasValue = true,
            Dob = p.Dob,
            Gender = p.Gender,
            Address = p.Address,
            CreatedBy = receptionist.Id,
            TenantId = Guid.Empty,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Patients.Add(patient);

        db.PatientConsents.Add(new PatientConsent
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            Purpose = "care_delivery",
            CapturedBy = receptionist.Id,
            CapturedAt = DateTimeOffset.UtcNow
        });
    }

    await db.SaveChangesAsync();

    var today = DateOnly.FromDateTime(DateTime.UtcNow);
    var appointmentTimes = new[] { "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00" };
    var createdPatients = db.Patients.Take(3).ToList();

    for (int i = 0; i < createdPatients.Count; i++)
    {
        var patient = createdPatients[i];
        var time = appointmentTimes[i];

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            DoctorId = doctor.Id,
            ClinicId = clinic.Id,
            Date = today,
            TimeSlot = time,
            Type = AppointmentType.Scheduled,
            Status = AppointmentStatus.Booked,
            TenantId = Guid.Empty,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Appointments.Add(appointment);
    }

    var checkedInPatient = createdPatients.First();
    var checkedInAppointment = new Appointment
    {
        Id = Guid.NewGuid(),
        PatientId = checkedInPatient.Id,
        DoctorId = doctor.Id,
        ClinicId = clinic.Id,
        Date = today,
        TimeSlot = "14:00",
        Type = AppointmentType.Scheduled,
        Status = AppointmentStatus.CheckedIn,
        QueueToken = 1,
        TenantId = Guid.Empty,
        CreatedAt = DateTimeOffset.UtcNow
    };
    db.Appointments.Add(checkedInAppointment);

    await db.SaveChangesAsync();
    Log.Information("Development seed data created successfully.");
}