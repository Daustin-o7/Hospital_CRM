namespace Hospital_CRM.Api.Services.Typesense;

/// <summary>
/// Bindable configuration block for the Typesense section in appsettings.json.
/// </summary>
public class TypesenseOptions
{
    public const string SectionName = "Typesense";

    public string Host { get; set; } = "http://localhost:8108";
    public string ApiKey { get; set; } = string.Empty;
    public string Protocol { get; set; } = "http";
    public string PatientsCollection { get; set; } = "patients";
    public string MedicinesCollection { get; set; } = "medicines";
}
