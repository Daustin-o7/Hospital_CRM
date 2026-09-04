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
    public DbSet<ClinicSpecialHour> ClinicSpecialHours => Set<ClinicSpecialHour>();
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
    public DbSet<PrecheckSubmission> PrecheckSubmissions => Set<PrecheckSubmission>();
    public DbSet<PriorityLog> PriorityLogs => Set<PriorityLog>();
    public DbSet<ConsultTemplate> ConsultTemplates => Set<ConsultTemplate>();
    public DbSet<MessageTemplate> MessageTemplates => Set<MessageTemplate>();
    public DbSet<NotificationRule> NotificationRules => Set<NotificationRule>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<LabOrder> LabOrders => Set<LabOrder>();
    public DbSet<LabResult> LabResults => Set<LabResult>();
    public DbSet<LedgerExpense> LedgerExpenses => Set<LedgerExpense>();
    public DbSet<ImpersonationLog> ImpersonationLogs => Set<ImpersonationLog>();
    public DbSet<TenantFeatureFlag> TenantFeatureFlags => Set<TenantFeatureFlag>();
    public DbSet<Drug> Drugs => Set<Drug>();
    public DbSet<DrugBatch> DrugBatches => Set<DrugBatch>();
    public DbSet<DispenseRecord> DispenseRecords => Set<DispenseRecord>();
    public DbSet<DispenseItem> DispenseItems => Set<DispenseItem>();
    public DbSet<ControlledSubstanceRegister> ControlledSubstanceRegisters => Set<ControlledSubstanceRegister>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();

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
            e.Property(x => x.OrganizationType).HasMaxLength(100);
            e.Property(x => x.LegalName).HasMaxLength(255);
            e.Property(x => x.Address).HasMaxLength(500);
            e.Property(x => x.Phone).HasMaxLength(20);
            e.Property(x => x.Email).HasMaxLength(255);
            e.Property(x => x.Website).HasMaxLength(255);
            e.Property(x => x.Timezone).HasMaxLength(50).IsRequired();
            e.Property(x => x.Currency).HasMaxLength(10).IsRequired();
            e.Property(x => x.DateFormat).HasMaxLength(20).IsRequired();
            e.Property(x => x.TimeFormat).HasMaxLength(20).IsRequired();
            e.Property(x => x.Language).HasMaxLength(10);
            e.Property(x => x.LogoUrl).HasMaxLength(500);
            e.Property(x => x.DarkLogoUrl).HasMaxLength(500);
            e.Property(x => x.LightLogoUrl).HasMaxLength(500);
            e.Property(x => x.FaviconUrl).HasMaxLength(500);
            e.Property(x => x.PrimaryColor).HasMaxLength(20);
            e.Property(x => x.SecondaryColor).HasMaxLength(20);
            e.Property(x => x.AccentColor).HasMaxLength(20);
            e.Property(x => x.InvoicePrefix).HasMaxLength(20);
            e.Property(x => x.TokenFormat).HasMaxLength(20);
            e.Property(x => x.TokenResetFrequency).HasMaxLength(20);
            e.Property(x => x.TenantId).HasDefaultValue(Guid.Empty);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<ClinicHours>(e =>
        {
            e.HasKey(x => x.Id);
            // Allow multiple shifts per day (e.g., 09:00–13:00 and 14:00–18:00)
            e.HasIndex(x => new { x.ClinicId, x.DayOfWeek, x.ShiftIndex }).IsUnique();
            e.Property(x => x.OpenTime).HasMaxLength(10);
            e.Property(x => x.CloseTime).HasMaxLength(10);
            e.HasOne(x => x.Clinic).WithMany(c => c.WorkingHours).HasForeignKey(x => x.ClinicId);
        });

        modelBuilder.Entity<ClinicHoliday>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(255);
            e.Property(x => x.StartDate).HasMaxLength(255);
            e.Property(x => x.EndDate).HasMaxLength(255);
            e.Property(x => x.InternalNote).HasMaxLength(500);
            e.HasOne(x => x.Clinic).WithMany(c => c.Holidays).HasForeignKey(x => x.ClinicId);
        });

        modelBuilder.Entity<ClinicSpecialHour>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ClinicId, x.Date }).IsUnique();
            e.Property(x => x.Date).HasMaxLength(255);
            e.Property(x => x.OpenTime).HasMaxLength(10);
            e.Property(x => x.CloseTime).HasMaxLength(10);
            e.Property(x => x.Reason).HasMaxLength(500);
            e.HasOne(x => x.Clinic).WithMany(c => c.SpecialHours).HasForeignKey(x => x.ClinicId);
        });

        modelBuilder.Entity<Patient>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Phone).IsUnique();
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
            e.HasIndex(x => new { x.DoctorId, x.Date, x.TimeSlot }).IsUnique().HasFilter("\"Status\" <> 3");
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
            e.Property(x => x.UnitPrice).HasColumnType("decimal(18,2)");
            e.Property(x => x.Amount).HasColumnType("decimal(18,2)");
            e.Property(x => x.GstRate).HasColumnType("decimal(5,2)");
            e.Property(x => x.HsnCode).HasMaxLength(20);
            e.HasOne(x => x.Invoice).WithMany(i => i.LineItems).HasForeignKey(x => x.InvoiceId);
            e.HasOne(x => x.DrugBatch).WithMany().HasForeignKey(x => x.DrugBatchId);
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

        modelBuilder.Entity<PrecheckSubmission>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => x.AppointmentId);
            e.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
            e.Property(x => x.ChiefComplaint).HasMaxLength(2000);
            e.Property(x => x.SymptomDuration).HasMaxLength(500);
            e.Property(x => x.Medications).HasMaxLength(2000);
            e.Property(x => x.Allergies).HasMaxLength(1000);
            e.HasOne(x => x.Appointment).WithOne(a => a.PrecheckSubmission).HasForeignKey<PrecheckSubmission>(x => x.AppointmentId);
        });

        modelBuilder.Entity<PriorityLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.AppointmentId);
            e.HasOne(x => x.Appointment).WithMany(a => a.PriorityLogs).HasForeignKey(x => x.AppointmentId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.ChangedBy);
            e.Property(x => x.ChangedTo).HasMaxLength(20).IsRequired();
        });

        modelBuilder.Entity<ConsultTemplate>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Specialty, x.DoctorId });
            e.Property(x => x.Specialty).HasMaxLength(50).IsRequired();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.StructureJson).HasColumnType("jsonb").IsRequired();
        });

        modelBuilder.Entity<MessageTemplate>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Content).HasMaxLength(2000).IsRequired();
        });

        modelBuilder.Entity<NotificationRule>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.Active });
            e.Property(x => x.TimingConfigJson).HasColumnType("jsonb").IsRequired();
            e.HasOne(x => x.Template).WithMany().HasForeignKey(x => x.TemplateId);
        });

        modelBuilder.Entity<NotificationLog>(e =>
        {
            e.Property(x => x.RuleId).IsRequired(false);
        });

        modelBuilder.Entity<InventoryItem>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.Active });
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Unit).HasMaxLength(30).IsRequired();
        });

        modelBuilder.Entity<StockMovement>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ItemId, x.RecordedAt });
            e.Property(x => x.Note).HasMaxLength(500);
            e.HasOne(x => x.Item).WithMany(i => i.Movements).HasForeignKey(x => x.ItemId);
            e.HasOne(x => x.Recorder).WithMany().HasForeignKey(x => x.RecordedBy);
        });

        modelBuilder.Entity<LabOrder>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
            e.HasIndex(x => x.ConsultationId);
            e.Property(x => x.TestName).HasMaxLength(200).IsRequired();
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.HasOne(x => x.Consultation).WithMany().HasForeignKey(x => x.ConsultationId);
            e.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId);
            e.HasOne(x => x.Doctor).WithMany().HasForeignKey(x => x.DoctorId);
        });

        modelBuilder.Entity<LabResult>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.LabOrderId, x.Version });
            e.Property(x => x.ResultText).HasMaxLength(5000);
            e.Property(x => x.FileUrl).HasMaxLength(500);
            e.HasOne(x => x.LabOrder).WithMany(o => o.Results).HasForeignKey(x => x.LabOrderId);
            e.HasOne(x => x.PreviousVersion).WithMany().HasForeignKey(x => x.PreviousVersionId);
            e.HasOne(x => x.EnteredByUser).WithMany().HasForeignKey(x => x.EnteredBy);
        });

        modelBuilder.Entity<LedgerExpense>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.ExpenseDate });
            e.Property(x => x.Amount).HasColumnType("decimal(18,2)");
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.CategoryOther).HasMaxLength(100).IsRequired();
            e.HasOne(x => x.Recorder).WithMany().HasForeignKey(x => x.RecordedBy);
        });

        modelBuilder.Entity<ImpersonationLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.StartedAt });
            e.Property(x => x.Reason).HasMaxLength(500);
        });

        modelBuilder.Entity<TenantFeatureFlag>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.FlagName }).IsUnique();
            e.Property(x => x.FlagName).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<Drug>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.Name });
            e.HasIndex(x => x.GenericName);
            e.HasIndex(x => x.ScheduleClass);
            e.Property(x => x.Name).HasMaxLength(255).IsRequired();
            e.Property(x => x.GenericName).HasMaxLength(255).IsRequired();
            e.Property(x => x.TherapeuticCategory).HasMaxLength(100);
            e.Property(x => x.DosageForm).HasMaxLength(50);
            e.Property(x => x.Strength).HasMaxLength(50);
            e.Property(x => x.HsnCode).HasMaxLength(20);
            e.Property(x => x.GstRate).HasColumnType("decimal(5,2)");
            e.Property(x => x.DpcoCeilingPrice).HasColumnType("decimal(18,2)");
            e.Property(x => x.IndicativeMrp).HasColumnType("decimal(18,2)");
            e.Property(x => x.StandardPackSize).HasMaxLength(50);
            e.Property(x => x.CommonBrands).HasMaxLength(500);
        });

        modelBuilder.Entity<DrugBatch>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.DrugId, x.ExpiryDate });
            e.HasIndex(x => x.BatchNumber);
            e.Property(x => x.BatchNumber).HasMaxLength(100).IsRequired();
            e.Property(x => x.Mrp).HasColumnType("decimal(18,2)");
            e.Property(x => x.PurchaseRate).HasColumnType("decimal(18,2)");
            e.HasOne(x => x.Drug).WithMany(d => d.Batches).HasForeignKey(x => x.DrugId);
            e.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId);
        });

        modelBuilder.Entity<DispenseRecord>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.DispensedAt });
            e.HasIndex(x => x.PrescriptionId);
            e.Property(x => x.WalkInCustomerName).HasMaxLength(255);
            e.Property(x => x.IdempotencyKey).HasMaxLength(128);
            e.HasOne(x => x.Prescription).WithMany().HasForeignKey(x => x.PrescriptionId);
            e.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId);
            e.HasOne(x => x.Dispenser).WithMany().HasForeignKey(x => x.DispensedBy);
        });

        modelBuilder.Entity<DispenseItem>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.DispenseRecordId);
            e.Property(x => x.UnitPrice).HasColumnType("decimal(18,2)");
            e.HasOne(x => x.DispenseRecord).WithMany(r => r.Items).HasForeignKey(x => x.DispenseRecordId);
            e.HasOne(x => x.PrescriptionItem).WithMany().HasForeignKey(x => x.PrescriptionItemId);
            e.HasOne(x => x.DrugBatch).WithMany().HasForeignKey(x => x.DrugBatchId);
        });

        modelBuilder.Entity<ControlledSubstanceRegister>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.ScheduleClass, x.DispensedAt });
            e.Property(x => x.DrugName).HasMaxLength(255).IsRequired();
            e.Property(x => x.BatchNumber).HasMaxLength(100).IsRequired();
            e.Property(x => x.PatientName).HasMaxLength(255).IsRequired();
            e.Property(x => x.PatientAddress).HasMaxLength(500);
            e.Property(x => x.PrescriberName).HasMaxLength(255).IsRequired();
            e.Property(x => x.PrescriberRegNo).HasMaxLength(100).IsRequired();
            e.Property(x => x.DispenserName).HasMaxLength(255);
            e.HasOne(x => x.Drug).WithMany().HasForeignKey(x => x.DrugId);
            e.HasOne(x => x.DispenseRecord).WithMany().HasForeignKey(x => x.DispenseRecordId);
            e.HasOne(x => x.Invoice).WithMany().HasForeignKey(x => x.InvoiceId);
        });

        modelBuilder.Entity<Supplier>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.Name });
            e.Property(x => x.Name).HasMaxLength(255).IsRequired();
            e.Property(x => x.Gstin).HasMaxLength(50);
            e.Property(x => x.Phone).HasMaxLength(20);
            e.Property(x => x.Email).HasMaxLength(255);
            e.Property(x => x.Address).HasMaxLength(500);
        });

        modelBuilder.Entity<PurchaseOrder>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TenantId, x.CreatedAt });
            e.Property(x => x.OrderNumber).HasMaxLength(50).IsRequired();
            e.Property(x => x.DistributorName).HasMaxLength(255).IsRequired();
            e.Property(x => x.ItemsJson).HasColumnType("jsonb");
            e.HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId);
            e.HasOne(x => x.Creator).WithMany().HasForeignKey(x => x.CreatedBy);
        });
    }
}