using System.Text.Json.Serialization;

namespace Hospital_CRM.Api.Services.Typesense;

/// <summary>
/// Wire-format patient document for the Typesense "patients" collection.
/// tenant_id is stored as string (UUID) with facet:true so scoped API keys
/// can apply filter_by: tenant_id:=X server-side. id is the patient UUID.
/// </summary>
public class TypesensePatientDocument
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("tenant_id")]
    public string TenantId { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("phone")]
    public string Phone { get; set; } = string.Empty;

    [JsonPropertyName("dob")]
    public string? Dob { get; set; }

    [JsonPropertyName("gender")]
    public string? Gender { get; set; }

    [JsonPropertyName("address")]
    public string? Address { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("created_at")]
    public long CreatedAt { get; set; }
}
