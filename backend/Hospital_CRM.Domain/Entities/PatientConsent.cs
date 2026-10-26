using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class PatientConsent
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    
    [MaxLength(255)]
    public string Purpose { get; set; } = string.Empty;

    [MaxLength(50)]
    public string NoticeVersion { get; set; } = "v1.0";

    [MaxLength(10)]
    public string Language { get; set; } = "en";

    [MaxLength(50)]
    public string CaptureMethod { get; set; } = "receptionist_assisted";
    
    public Guid CapturedBy { get; set; }
    public string? GuardianName { get; set; }
    public string? GuardianRelationship { get; set; }
    
    public DateTimeOffset CapturedAt { get; set; }
    public DateTimeOffset? WithdrawnAt { get; set; }
    
    // Navigation
    public virtual Patient Patient { get; set; } = null!;
    public virtual User CapturedByUser { get; set; } = null!;
}