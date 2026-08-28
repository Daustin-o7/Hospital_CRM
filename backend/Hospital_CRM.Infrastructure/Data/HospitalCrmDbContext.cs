using Microsoft.EntityFrameworkCore;
using Hospital_CRM.Domain.Entities;

namespace Hospital_CRM.Infrastructure.Data;

public class HospitalCrmDbContext : DbContext
{
    public HospitalCrmDbContext(DbContextOptions<HospitalCrmDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<StaffInvite> StaffInvites => Set<StaffInvite>();
    public DbSet<Clinic> Clinics => Set<Clinic>();
    public DbSet<ClinicHours> ClinicHours => Set<ClinicHours>();
    public DbSet<ClinicHoliday> ClinicHolidays => Set<ClinicHoliday>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<PatientConsent> PatientConsents => Set<PatientConsent>();
    public DbSet<PatientAuditLog> PatientAuditLogs => Set<PatientAuditLog>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<AppointmentHistory> AppointmentHistories => Set<AppointmentHistory>();
    public DbSet<Consultation> Consultations => Set<Consultation>();
    public DbSet<Prescription> Prescriptions => Set<Prescription>();
    public DbSet<PrescriptionItem> PrescriptionItems => Set<PrescriptionItem>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLineItem> InvoiceLineItems => Set<InvoiceLineItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        ApplyConfigurations(modelBuilder);
    }

    private static void ApplyConfigurations(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Name).HasMaxLength(255);
            e.Property(x => x.Email).HasMaxLength(255);
            e.Property(x => x.PasswordHash).HasMaxLength(255);
            e.Property(x => x.TenantId).HasDefaultValue(Guid.Empty);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.Clinic).WithMany(c => c.Users).HasForeignKey(x => x.ClinicId);
        });

        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.TokenHash }).IsUnique();
            e.HasIndex(x => x.LastUsedAt);
            e.Property(x => x.TokenHash).HasMaxLength(512);
            e.HasOne(x => x.User).WithMany(u => u.RefreshTokens).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<PasswordResetToken>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.TokenHash).HasMaxLength(512);
            e.HasOne(x => x.User).WithMany(u => u.PasswordResetTokens).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<StaffInvite>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ClinicId, x.Email, x.AcceptedAt });
            e.Property(x => x.Name).HasMaxLength(255);
            e.Property(x => x.Email).HasMaxLength(255);
            e.Property(x => x.TokenHash).HasMaxLength(512);
            e.HasOne(x => x.Clinic).WithMany(c => c.StaffInvites).HasForeignKey(x => x.ClinicId);
        });

        modelBuilder.Entity<Clinic>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(255);
            e.Property(x => x.TenantId).HasDefaultValue(Guid.Empty);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<ClinicHours>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ClinicId, x.DayOfWeek }).IsUnique();
            e.Property(x => x.OpenTime).HasMaxLength(10);
            e.Property(x => x.CloseTime).HasMaxLength(10);
            e.HasOne(x => x.Clinic).WithMany(c => c.WorkingHours).HasForeignKey(x => x.ClinicId);
        });

        modelBuilder.Entity<ClinicHoliday>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ClinicId, x.Date }).IsUnique();
            e.Property(x => x.Date).HasMaxLength(255);
            e.HasOne(x => x.Clinic).WithMany(c => c.Holidays).HasForeignKey(x => x.ClinicId);
        });

        modelBuilder.Entity<Patient>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Phone);
            e.HasIndex(x => x.Name); // trigram GIN index added via migration separately
            e.HasIndex(x => x.IdempotencyKey).IsUnique().HasFilter("\"IdempotencyKey\" IS NOT NULL");
            e.Property(x => x.Name).HasMaxLength(255);
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.TenantId).HasDefaultValue(Guid.Empty);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.CreatedByUser).WithMany(u => u.CreatedPatients).HasForeignKey(x => x.CreatedBy);
        });

        modelBuilder.Entity<PatientConsent>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Purpose).HasMaxLength(255);
            e.Property(x => x.CapturedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.Patient).WithMany(p => p.Consents).HasForeignKey(x => x.PatientId);
            e.HasOne(x => x.CapturedByUser).WithMany(u => u.CapturedConsents).HasForeignKey(x => x.CapturedBy);
        });

        modelBuilder.Entity<PatientAuditLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.PatientId, x.ChangedAt });
            e.Property(x => x.FieldName).HasMaxLength(100);
            e.Property(x => x.OldValue).HasMaxLength(255);
            e.Property(x => x.NewValue).HasMaxLength(255);
            e.Property(x => x.ChangedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.ChangedByUser).WithMany(u => u.PatientAuditLogs).HasForeignKey(x => x.ChangedBy);
        });

        modelBuilder.Entity<Appointment>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.DoctorId, x.Date, x.TimeSlot }).IsUnique();
            e.HasIndex(x => new { x.PatientId, x.Date });
            e.Property(x => x.TimeSlot).HasMaxLength(10);
            e.Property(x => x.TenantId).HasDefaultValue(Guid.Empty);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.Patient).WithMany(p => p.Appointments).HasForeignKey(x => x.PatientId);
            e.HasOne(x => x.Doctor).WithMany(u => u.AppointmentsAsDoctor).HasForeignKey(x => x.DoctorId);
            e.HasOne(x => x.Clinic).WithMany().HasForeignKey(x => x.ClinicId);
        });

        modelBuilder.Entity<AppointmentHistory>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.AppointmentId);
            e.Property(x => x.PreviousTimeSlot).HasMaxLength(10);
            e.Property(x => x.ChangedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.Appointment).WithMany(a => a.History).HasForeignKey(x => x.AppointmentId);
        });

        modelBuilder.Entity<Consultation>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.AppointmentId);
            e.HasIndex(x => new { x.DoctorId, x.CreatedAt });
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.Appointment).WithMany(a => a.Consultations).HasForeignKey(x => x.AppointmentId);
            e.HasOne(x => x.Doctor).WithMany(u => u.Consultations).HasForeignKey(x => x.DoctorId);
            e.HasOne(x => x.PreviousVersion).WithMany().HasForeignKey(x => x.PreviousVersionId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Prescription>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.ConsultationId);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.Consultation).WithMany(c => c.Prescriptions).HasForeignKey(x => x.ConsultationId);
        });

        modelBuilder.Entity<PrescriptionItem>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.MedicineText).HasMaxLength(500);
            e.Property(x => x.DosageText).HasMaxLength(255);
            e.Property(x => x.FrequencyText).HasMaxLength(255);
            e.Property(x => x.DurationText).HasMaxLength(255);
            e.HasOne(x => x.Prescription).WithMany(p => p.Items).HasForeignKey(x => x.PrescriptionId);
        });

        modelBuilder.Entity<Invoice>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Status, x.CreatedAt });
            e.HasIndex(x => x.AppointmentId);
            e.HasIndex(x => x.IdempotencyKey).IsUnique().HasFilter("\"IdempotencyKey\" IS NOT NULL");
            e.Property(x => x.TenantId).HasDefaultValue(Guid.Empty);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.Appointment).WithMany().HasForeignKey(x => x.AppointmentId);
        });

        modelBuilder.Entity<InvoiceLineItem>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.InvoiceId);
            e.Property(x => x.Description).HasMaxLength(500);
            e.HasOne(x => x.Invoice).WithMany().HasForeignKey(x => x.InvoiceId);
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.InvoiceId);
            e.HasIndex(x => x.IdempotencyKey).IsUnique().HasFilter("\"IdempotencyKey\" IS NOT NULL");
            e.Property(x => x.RazorpayPaymentId).HasMaxLength(255);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.HasOne(x => x.Invoice).WithMany(inv => inv.Payments).HasForeignKey(x => x.InvoiceId);
        });

        modelBuilder.Entity<NotificationLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.AppointmentId, x.Status });
            e.Property(x => x.Template).HasMaxLength(100);
            e.Property(x => x.FailedReason).HasMaxLength(500);
            e.HasOne(x => x.Appointment).WithMany().HasForeignKey(x => x.AppointmentId);
        });
    }
}