using System.Text;
using Hangfire;
using Hangfire.Dashboard;
using Hangfire.PostgreSql;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Middlewares;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
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

// JWT static config validation
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? (builder.Environment.IsDevelopment() ? "Hospital_CRM"
        : throw new InvalidOperationException("Jwt:Issuer configuration is missing."));
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? (builder.Environment.IsDevelopment() ? "Hospital_CRM"
        : throw new InvalidOperationException("Jwt:Audience configuration is missing."));

// Register IPersistentKeyService — chosen by Jwt:KeySource config.
// PemFileKeyService: auto-generates a key on first run in Development,
//                    fails fast in non-Development environments.
// AzureKeyVaultKeyService: loads from Key Vault; private key never leaves vault.
var keySource = builder.Configuration["Jwt:KeySource"] ?? (builder.Environment.IsDevelopment() ? "PemFile" : throw new InvalidOperationException("Jwt:KeySource configuration is missing."));
builder.Services.AddSingleton<IPersistentKeyService>(sp =>
{
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    return keySource.ToLowerInvariant() switch
    {
        "pemfile" => new PemFileKeyService(builder.Configuration, env, sp.GetRequiredService<ILogger<PemFileKeyService>>()),
        "azurekeyvault" => new AzureKeyVaultKeyService(builder.Configuration, env, sp.GetRequiredService<ILogger<AzureKeyVaultKeyService>>()),
        _ => throw new InvalidOperationException($"Unknown Jwt:KeySource '{keySource}'. Supported: PemFile, AzureKeyVault.")
    };
});

// JWT Bearer auth — IssuerSigningKey is resolved per-request from the
// already-loaded IPersistentKeyService via OnCreatingTicket. This avoids
// the BuildServiceProvider() anti-pattern and works correctly when the
// key service is a singleton.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            ClockSkew = TimeSpan.Zero,
            RoleClaimType = "role",
            NameClaimType = "sub"
        };
    });

// IPostConfigureOptions runs after all singletons (including IPersistentKeyService)
// are registered. This injects the RS256 public key without BuildServiceProvider().
builder.Services.AddSingleton<IPostConfigureOptions<JwtBearerOptions>, Hospital_CRM.Api.JwtBearerOptionsConfig>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOrDoctor", p =>
        p.Requirements.Add(new RbacRequirement("ClinicAdmin", "Doctor")));
    options.AddPolicy("AdminOrReceptionist", p =>
        p.Requirements.Add(new RbacRequirement("ClinicAdmin", "Receptionist")));
    options.AddPolicy("PharmacyAccess", p =>
        p.Requirements.Add(new RbacRequirement("ClinicAdmin", "Pharmacist", "Doctor", "Receptionist", "Nurse")));
    options.AddPolicy("PharmacistOnly", p =>
        p.Requirements.Add(new RbacRequirement("ClinicAdmin", "Pharmacist")));
    options.AddPolicy("AllRoles", p =>
        p.Requirements.Add(new RbacRequirement("ClinicAdmin", "Doctor", "Receptionist", "Pharmacist", "Nurse")));
});

builder.Services.AddSingleton<IAuthorizationHandler, RbacHandler>();

// CORS for React frontend (supports dev defaults + configured origins)
var configuredOrigins = builder.Configuration["Cors:AllowedOrigins"]
    ?.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? Array.Empty<string>();

var allowedOrigins = new HashSet<string>(configuredOrigins, StringComparer.OrdinalIgnoreCase)
{
    "http://localhost:5173",
    "https://localhost:5173",
    "http://localhost:8080",
    "http://localhost:80",
    "http://localhost",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1"
};

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins.ToArray())
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// FR-20/21: Notification services
builder.Services.AddSingleton<INotificationService, StubNotificationService>();
builder.Services.AddHostedService<ReminderSchedulerService>();

// MOD-23 (Phase 2): pre-check link generation / submission lookup
builder.Services.AddScoped<PrecheckService>();

// FR-18 edge case (Phase 1): Razorpay reconciliation worker
builder.Services.AddHostedService<RazorpayReconciliationWorker>();

// MOD-13 (Phase 2): notification rules engine worker (FR-13-03)
builder.Services.AddHostedService<NotificationRulesWorker>();

// Hangfire (Phase 2 TRD §2 background jobs).
// Reuses the existing Postgres instance — strategy-v0.5 §6 chose Postgres
// over SQL Server specifically to avoid per-core licensing. Connection
// string is read from config (Hangfire:PostgreSql:Connection) which is
// fed by Hangfire__PostgreSql__Connection in docker-compose.
var hangfireConn = builder.Configuration["Hangfire:PostgreSql:Connection"]
    ?? builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(hangfireConn))
{
    throw new InvalidOperationException("Hangfire connection string is missing. Set Hangfire:PostgreSql:Connection or ConnectionStrings:DefaultConnection.");
}
builder.Services.AddHangfire(config => config
    .UsePostgreSqlStorage(c => c.UseNpgsqlConnection(hangfireConn))
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings());
builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = Environment.ProcessorCount * 2;
});

var app = builder.Build();

// Load the persistent RS256 key BEFORE serving any traffic.
// - PemFile: reads from disk (auto-generates in Development on first run).
// - AzureKeyVault: fetches public key + remote signing endpoint.
// Failures here crash startup — better than running with no signing key.
using (var scope = app.Services.CreateScope())
{
    var keyService = scope.ServiceProvider.GetRequiredService<IPersistentKeyService>();
    await keyService.LoadAsync();
    Log.Information("JWT signing key loaded (source: {Source})", keyService.KeySource);
}

// Database migrations and startup seeding
var autoMigrate = app.Configuration.GetValue<bool?>("Database:AutoMigrate") ?? true;
if (autoMigrate)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<HospitalCrmDbContext>();
    var eraseOnStartup = app.Configuration.GetValue<bool>("Database:EraseOnStartup");

    if (eraseOnStartup && app.Environment.IsDevelopment())
    {
        Log.Information("Erasing development database...");
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
        await SeedDevelopmentDataAsync(db);
    }
    else
    {
        Log.Information("Applying database migrations...");
        await db.Database.MigrateAsync();

        if (app.Environment.IsDevelopment())
        {
            if (!await db.Users.AnyAsync())
            {
                Log.Information("Seeding initial development data...");
                await SeedDevelopmentDataAsync(db);
            }
            else
            {
                if (!await db.Users.AnyAsync(u => u.Role == UserRole.Pharmacist))
                {
                    var clinic = await db.Clinics.FirstOrDefaultAsync();
                    if (clinic != null)
                    {
                        db.Users.Add(new User
                        {
                            Id = Guid.NewGuid(),
                            Email = "pharmacist@samstack.ai",
                            PasswordHash = BCrypt.Net.BCrypt.HashPassword("PharmacistPass123!"),
                            Name = "Pharmacist Alex",
                            Role = UserRole.Pharmacist,
                            ClinicId = clinic.Id,
                            TenantId = Guid.Empty,
                            CreatedAt = DateTimeOffset.UtcNow,
                            UpdatedAt = DateTimeOffset.UtcNow
                        });
                        db.Users.Add(new User
                        {
                            Id = Guid.NewGuid(),
                            Email = "nurse@samstack.ai",
                            PasswordHash = BCrypt.Net.BCrypt.HashPassword("NursePass123!"),
                            Name = "Nurse Joy",
                            Role = UserRole.Nurse,
                            ClinicId = clinic.Id,
                            TenantId = Guid.Empty,
                            CreatedAt = DateTimeOffset.UtcNow,
                            UpdatedAt = DateTimeOffset.UtcNow
                        });
                        await db.SaveChangesAsync();
                    }
                }
                if (!await db.Drugs.AnyAsync())
                {
                    Log.Information("Seeding Track 2 Pharmacy Catalog...");
                    await SeedPharmacyDataAsync(db);
                    await db.SaveChangesAsync();
                }
            }
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");

// MOD-08: serve uploaded lab result files from local disk (S3 swap in TRD-Phase2)
var labUploadDir = Path.Combine(builder.Environment.ContentRootPath, "lab-uploads");
Directory.CreateDirectory(labUploadDir);
app.UseStaticFiles(new Microsoft.AspNetCore.Builder.StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(labUploadDir),
    RequestPath = "/lab-uploads"
});

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<InactivityMiddleware>();

// Hangfire dashboard - gated to ClinicAdmin role.
// Mounted at /hangfire. Production should additionally restrict by network/IIS.
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new HangfireAdminAuthorizationFilter() }
});

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

    // MOD-14: SAMSTACK's own platform admin — separate from clinic users.
    // TenantId is empty (no clinic), ClinicId is null (no clinic association).
    var platformAdmin = new User
    {
        Id = Guid.NewGuid(),
        Email = "platform-admin@samstack.ai",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword("PlatformAdminPass123!"),
        Name = "SAMSTACK Platform Admin",
        Role = UserRole.PlatformAdmin,
        ClinicId = null,
        TenantId = Guid.Empty,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
    db.Users.Add(platformAdmin);

    var pharmacist = new User
    {
        Id = Guid.NewGuid(),
        Email = "pharmacist@samstack.ai",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword("PharmacistPass123!"),
        Name = "Pharmacist Alex",
        Role = UserRole.Pharmacist,
        ClinicId = clinic.Id,
        TenantId = Guid.Empty,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
    db.Users.Add(pharmacist);

    var nurse = new User
    {
        Id = Guid.NewGuid(),
        Email = "nurse@samstack.ai",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword("NursePass123!"),
        Name = "Nurse Joy",
        Role = UserRole.Nurse,
        ClinicId = clinic.Id,
        TenantId = Guid.Empty,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
    db.Users.Add(nurse);

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

    // MOD-12: Three built-in consult templates — Dental, General/Family, Ayurveda/AYUSH
    // (from survey-analysis-v2 actual specialty distribution: 25%/17%/17%)
    var templates = new[]
    {
        new ConsultTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            DoctorId = null,
            Specialty = "dental",
            Name = "Dental — Standard Exam",
            IsBuiltIn = true,
            CreatedAt = DateTimeOffset.UtcNow,
            StructureJson = "{\"sections\":[{\"key\":\"chief_complaint\",\"label\":\"Chief Complaint\",\"type\":\"text\",\"placeholder\":\"e.g. pain in upper right molar\"},{\"key\":\"dental_history\",\"label\":\"Dental History\",\"type\":\"textarea\",\"placeholder\":\"Previous treatments, allergies to anaesthetic, brushing frequency\"},{\"key\":\"examination\",\"label\":\"Examination Findings\",\"type\":\"textarea\",\"placeholder\":\"Caries, mobility, percussion, palpation, periodontal status\"},{\"key\":\"investigation\",\"label\":\"Investigations Ordered\",\"type\":\"text\",\"placeholder\":\"e.g. IOPAR, OPG, pulp vitality test\"},{\"key\":\"diagnosis\",\"label\":\"Diagnosis\",\"type\":\"text\"},{\"key\":\"treatment_plan\",\"label\":\"Treatment Plan\",\"type\":\"textarea\"},{\"key\":\"prescription\",\"label\":\"Prescription\",\"type\":\"textarea\"},{\"key\":\"advice\",\"label\":\"Patient Advice\",\"type\":\"textarea\",\"placeholder\":\"Oral hygiene, follow-up date, dietary advice\"}]}"
        },
        new ConsultTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            DoctorId = null,
            Specialty = "general",
            Name = "General / Family Medicine — Standard Consult",
            IsBuiltIn = true,
            CreatedAt = DateTimeOffset.UtcNow,
            StructureJson = "{\"sections\":[{\"key\":\"chief_complaint\",\"label\":\"Chief Complaint\",\"type\":\"text\",\"placeholder\":\"e.g. fever for 3 days\"},{\"key\":\"hpi\",\"label\":\"History of Present Illness\",\"type\":\"textarea\",\"placeholder\":\"Onset, duration, character, relieving/aggravating factors\"},{\"key\":\"pmh\",\"label\":\"Past Medical History\",\"type\":\"textarea\",\"placeholder\":\"Comorbidities, prior surgeries, current medications\"},{\"key\":\"examination\",\"label\":\"General / Systemic Examination\",\"type\":\"textarea\",\"placeholder\":\"Vitals, general appearance, system-wise findings\"},{\"key\":\"investigation\",\"label\":\"Investigations Ordered\",\"type\":\"text\"},{\"key\":\"diagnosis\",\"label\":\"Diagnosis\",\"type\":\"textarea\"},{\"key\":\"treatment_plan\",\"label\":\"Treatment Plan\",\"type\":\"textarea\"},{\"key\":\"prescription\",\"label\":\"Prescription\",\"type\":\"textarea\"},{\"key\":\"advice\",\"label\":\"Patient Advice\",\"type\":\"textarea\",\"placeholder\":\"Diet, activity, warning signs, follow-up\"}]}"
        },
        new ConsultTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            DoctorId = null,
            Specialty = "ayurveda",
            Name = "Ayurveda / AYUSH — Panchakarma Consult",
            IsBuiltIn = true,
            CreatedAt = DateTimeOffset.UtcNow,
            StructureJson = "{\"sections\":[{\"key\":\"chief_complaint\",\"label\":\"Chief Complaint (Pradhan Vedana)\",\"type\":\"text\"},{\"key\":\"hetu\",\"label\":\"Hetu (Causative Factors)\",\"type\":\"textarea\",\"placeholder\":\"Ahara, Vihara, seasonal triggers\"},{\"key\":\"prakriti\",\"label\":\"Prakriti Assessment\",\"type\":\"text\",\"placeholder\":\"Vata / Pitta / Kapha dominant\"},{\"key\":\"vikriti\",\"label\":\"Vikriti (Current Imbalance)\",\"type\":\"textarea\",\"placeholder\":\"Agni, Dosha vitiation, Srotas involved\"},{\"key\":\"examination\",\"label\":\"Examination (Ashta Vidha Pariksha)\",\"type\":\"textarea\",\"placeholder\":\"Nadi, Mutra, Mala, Jihva, Shabda, Sparsha, Drik, Akriti\"},{\"key\":\"diagnosis\",\"label\":\"Diagnosis (Samprapti)\",\"type\":\"textarea\"},{\"key\":\"treatment_plan\",\"label\":\"Chikitsa (Treatment Plan)\",\"type\":\"textarea\",\"placeholder\":\"Samshodhana / Shamana, diet, lifestyle\"},{\"key\":\"prescription\",\"label\":\"Aushadha (Prescription)\",\"type\":\"textarea\",\"placeholder\":\"Classical formulation, dose, anupana, duration\"},{\"key\":\"advice\",\"label\":\"Pathya-Apathya (Do's and Don'ts)\",\"type\":\"textarea\"}]}"
        }
    };
    db.ConsultTemplates.AddRange(templates);

    // MOD-13: Phase 1 FR-20/21 message templates (now first-class, approval-pending until Meta confirms)
    var msgTplConfirmation = new MessageTemplate
    {
        Id = Guid.NewGuid(),
        TenantId = Guid.Empty,
        Name = "FR-20 Appointment Confirmation",
        Channel = NotificationChannel.WhatsApp,
        Content = "Your appointment at {{clinic_name}} is confirmed for {{date}} at {{time}}.",
        ApprovalStatus = TemplateApprovalStatus.Pending,
        CreatedAt = DateTimeOffset.UtcNow
    };
    var msgTplReminder = new MessageTemplate
    {
        Id = Guid.NewGuid(),
        TenantId = Guid.Empty,
        Name = "FR-21 Appointment Reminder (1 day before)",
        Channel = NotificationChannel.WhatsApp,
        Content = "Reminder: You have an appointment at {{clinic_name}} tomorrow at {{time}}.",
        ApprovalStatus = TemplateApprovalStatus.Pending,
        CreatedAt = DateTimeOffset.UtcNow
    };
    db.MessageTemplates.AddRange(msgTplConfirmation, msgTplReminder);

    // MOD-13: default rules that match Phase 1's FR-20/21 flow (so it's not lost)
    var defaultRules = new[]
    {
        new NotificationRule
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            RuleType = NotificationRuleType.AppointmentConfirmation,
            TimingConfigJson = "{}",
            TemplateId = msgTplConfirmation.Id,
            Active = true,
            CreatedAt = DateTimeOffset.UtcNow
        },
        new NotificationRule
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            RuleType = NotificationRuleType.AppointmentReminder,
            TimingConfigJson = "{\"daysBefore\":1}",
            TemplateId = msgTplReminder.Id,
            Active = true,
            CreatedAt = DateTimeOffset.UtcNow
        }
    };
    db.NotificationRules.AddRange(defaultRules);

    await db.SaveChangesAsync();

    // Track 2: Seed Indian Essential Medicines & Batches
    await SeedPharmacyDataAsync(db);

    await db.SaveChangesAsync();
    Log.Information("Development seed data created successfully.");
}

static async Task SeedPharmacyDataAsync(HospitalCrmDbContext db)
{
    if (await db.Drugs.AnyAsync()) return;

    var supplier = new Supplier
    {
        Id = Guid.NewGuid(),
        TenantId = Guid.Empty,
        Name = "MedSource India Healthcare Pvt Ltd",
        Gstin = "27AABCM8812K1Z0",
        Phone = "+91 98201 12345",
        Email = "orders@medsourceindia.com",
        Address = "Plot 42, MIDC Industrial Area, Andheri East, Mumbai, Maharashtra 400093",
        CreatedAt = DateTimeOffset.UtcNow
    };
    db.Suppliers.Add(supplier);

    var candidates = new[]
    {
        Path.Combine(AppContext.BaseDirectory, "SeedData", "Indian_Essential_Medicine_Master.csv"),
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Hospital_CRM.Infrastructure", "Data", "SeedData", "Indian_Essential_Medicine_Master.csv"),
        Path.Combine(Directory.GetCurrentDirectory(), "backend", "Hospital_CRM.Infrastructure", "Data", "SeedData", "Indian_Essential_Medicine_Master.csv"),
        Path.Combine(Directory.GetCurrentDirectory(), "..", "Hospital_CRM.Infrastructure", "Data", "SeedData", "Indian_Essential_Medicine_Master.csv")
    };

    string? csvPath = null;
    foreach (var c in candidates)
    {
        var full = Path.GetFullPath(c);
        if (File.Exists(full))
        {
            csvPath = full;
            break;
        }
    }

    var drugs = new List<Drug>();
    var batches = new List<DrugBatch>();
    var today = DateOnly.FromDateTime(DateTime.UtcNow);

    if (csvPath != null)
    {
        var lines = await File.ReadAllLinesAsync(csvPath);
        for (int i = 1; i < lines.Length; i++)
        {
            var line = lines[i];
            if (string.IsNullOrWhiteSpace(line)) continue;

            var parts = ParseCsvLine(line);
            if (parts.Count < 12) continue;

            var name = parts[0].Trim();
            var genericName = parts[1].Trim();
            var category = parts[2].Trim();
            var dosageForm = parts[3].Trim();
            var strength = parts[4].Trim();
            var schedStr = parts[5].Trim();
            var hsn = parts[6].Trim();
            decimal.TryParse(parts[7].Trim(), out var gstRate);
            var nlem = parts[8].Trim().Equals("Yes", StringComparison.OrdinalIgnoreCase);
            decimal? dpco = decimal.TryParse(parts[9].Trim(), out var dVal) ? dVal : null;
            var packSize = parts[10].Trim();
            decimal.TryParse(parts[11].Trim(), out var indicativeMrp);
            var commonBrands = parts.Count > 12 ? parts[12].Trim() : "";

            Enum.TryParse<ScheduleClass>(schedStr, true, out var schedClass);

            var drug = new Drug
            {
                Id = Guid.NewGuid(),
                TenantId = Guid.Empty,
                Name = name,
                GenericName = genericName,
                TherapeuticCategory = category,
                DosageForm = dosageForm,
                Strength = strength,
                ScheduleClass = schedClass,
                HsnCode = hsn,
                GstRate = gstRate > 0 ? gstRate : 12m,
                NlemCovered = nlem,
                DpcoCeilingPrice = dpco,
                StandardPackSize = packSize,
                IndicativeMrp = indicativeMrp,
                CommonBrands = commonBrands,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            drugs.Add(drug);

            var batchNumA = $"BAT-{i:D3}-A";
            var batchNumB = $"BAT-{i:D3}-B";

            batches.Add(new DrugBatch
            {
                Id = Guid.NewGuid(),
                TenantId = Guid.Empty,
                DrugId = drug.Id,
                BatchNumber = batchNumA,
                ExpiryDate = today.AddMonths(14 + (i % 12)),
                MfgDate = today.AddMonths(-4),
                QuantityReceived = 100,
                QuantityRemaining = 85,
                Mrp = indicativeMrp > 0 ? indicativeMrp : 50m,
                PurchaseRate = Math.Round((indicativeMrp > 0 ? indicativeMrp : 50m) * 0.65m, 2),
                SupplierId = supplier.Id,
                CreatedAt = DateTimeOffset.UtcNow
            });

            batches.Add(new DrugBatch
            {
                Id = Guid.NewGuid(),
                TenantId = Guid.Empty,
                DrugId = drug.Id,
                BatchNumber = batchNumB,
                ExpiryDate = today.AddMonths(28 + (i % 8)),
                MfgDate = today.AddMonths(-1),
                QuantityReceived = 150,
                QuantityRemaining = 150,
                Mrp = indicativeMrp > 0 ? indicativeMrp : 50m,
                PurchaseRate = Math.Round((indicativeMrp > 0 ? indicativeMrp : 50m) * 0.65m, 2),
                SupplierId = supplier.Id,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }
    }

    if (drugs.Count > 0)
    {
        db.Drugs.AddRange(drugs);
        db.DrugBatches.AddRange(batches);
    }
}

static List<string> ParseCsvLine(string line)
{
    var result = new List<string>();
    var inQuotes = false;
    var current = new StringBuilder();

    for (int i = 0; i < line.Length; i++)
    {
        char c = line[i];
        if (c == '"')
        {
            inQuotes = !inQuotes;
        }
        else if (c == ',' && !inQuotes)
        {
            result.Add(current.ToString());
            current.Clear();
        }
        else
        {
            current.Append(c);
        }
    }
    result.Add(current.ToString());
    return result;
}