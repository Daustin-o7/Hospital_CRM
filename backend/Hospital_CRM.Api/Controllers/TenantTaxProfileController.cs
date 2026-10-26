using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/clinic/tax-profile")]
public class TenantTaxProfileController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public TenantTaxProfileController(HospitalCrmDbContext db) => _db = db;

    private Guid TenantId => User.GetTenantId() ?? Guid.Empty;

    [HttpGet]
    [AuthorizeRoles("ClinicAdmin", "Receptionist", "Doctor")]
    public async Task<IActionResult> GetTaxProfile(CancellationToken ct)
    {
        var tenantId = TenantId;
        var profile = await _db.TenantTaxProfiles
            .FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);

        if (profile == null)
        {
            // Default exempt-first profile per Notification 12/2017
            return Ok(new
            {
                isGstRegistered = false,
                gstin = (string?)null,
                stateCode = "27",
                documentType = InvoiceDocumentType.BillOfSupply.ToString(),
                defaultOpdTaxCategory = TaxCategory.Exempt.ToString(),
                defaultOpdHsnSac = "999312",
                defaultOpdGstRate = 0.0m,
                thresholdHighValueUtr = 2000.0m,
                isDefault = true
            });
        }

        return Ok(new
        {
            id = profile.Id,
            isGstRegistered = profile.IsGstRegistered,
            gstin = profile.Gstin,
            stateCode = profile.StateCode,
            documentType = profile.DocumentType.ToString(),
            defaultOpdTaxCategory = profile.DefaultOpdTaxCategory.ToString(),
            defaultOpdHsnSac = profile.DefaultOpdHsnSac,
            defaultOpdGstRate = profile.DefaultOpdGstRate,
            thresholdHighValueUtr = profile.ThresholdHighValueUtr,
            isDefault = false
        });
    }

    [HttpPut]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> UpdateTaxProfile([FromBody] UpdateTaxProfileRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;
        if (tenantId == Guid.Empty)
            return Unauthorized(new { error = "invalid_tenant" });

        if (req.IsGstRegistered)
        {
            if (string.IsNullOrWhiteSpace(req.Gstin))
                return BadRequest(new { error = "gstin_required_when_registered" });

            // Standard Indian GSTIN pattern: 2 digits + 5 chars + 4 digits + 1 char + 1 char + Z + 1 char/digit
            if (!Regex.IsMatch(req.Gstin.Trim().ToUpperInvariant(), @"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"))
                return BadRequest(new { error = "invalid_gstin_format", message = "GSTIN must match standard 15-character Indian format" });
        }

        var profile = await _db.TenantTaxProfiles
            .FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);

        var docType = Enum.TryParse<InvoiceDocumentType>(req.DocumentType, true, out var dt)
            ? dt
            : (req.IsGstRegistered ? InvoiceDocumentType.TaxInvoice : InvoiceDocumentType.BillOfSupply);

        var taxCat = Enum.TryParse<TaxCategory>(req.DefaultOpdTaxCategory, true, out var tc)
            ? tc
            : TaxCategory.Exempt;

        if (profile == null)
        {
            profile = new TenantTaxProfile
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                IsGstRegistered = req.IsGstRegistered,
                Gstin = req.IsGstRegistered ? req.Gstin?.Trim().ToUpperInvariant() : null,
                StateCode = req.StateCode?.Trim(),
                DocumentType = docType,
                DefaultOpdTaxCategory = taxCat,
                DefaultOpdHsnSac = string.IsNullOrWhiteSpace(req.DefaultOpdHsnSac) ? "999312" : req.DefaultOpdHsnSac.Trim(),
                DefaultOpdGstRate = req.DefaultOpdGstRate,
                ThresholdHighValueUtr = req.ThresholdHighValueUtr > 0 ? req.ThresholdHighValueUtr : 2000.0m,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.TenantTaxProfiles.Add(profile);
        }
        else
        {
            profile.IsGstRegistered = req.IsGstRegistered;
            profile.Gstin = req.IsGstRegistered ? req.Gstin?.Trim().ToUpperInvariant() : null;
            profile.StateCode = req.StateCode?.Trim();
            profile.DocumentType = docType;
            profile.DefaultOpdTaxCategory = taxCat;
            profile.DefaultOpdHsnSac = string.IsNullOrWhiteSpace(req.DefaultOpdHsnSac) ? "999312" : req.DefaultOpdHsnSac.Trim();
            profile.DefaultOpdGstRate = req.DefaultOpdGstRate;
            profile.ThresholdHighValueUtr = req.ThresholdHighValueUtr > 0 ? req.ThresholdHighValueUtr : 2000.0m;
            profile.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = profile.Id,
            isGstRegistered = profile.IsGstRegistered,
            gstin = profile.Gstin,
            stateCode = profile.StateCode,
            documentType = profile.DocumentType.ToString(),
            defaultOpdTaxCategory = profile.DefaultOpdTaxCategory.ToString(),
            defaultOpdHsnSac = profile.DefaultOpdHsnSac,
            defaultOpdGstRate = profile.DefaultOpdGstRate,
            thresholdHighValueUtr = profile.ThresholdHighValueUtr
        });
    }
}

public record UpdateTaxProfileRequest(
    bool IsGstRegistered,
    string? Gstin,
    [MaxLength(2)] string? StateCode,
    string? DocumentType,
    string? DefaultOpdTaxCategory,
    string? DefaultOpdHsnSac,
    decimal DefaultOpdGstRate,
    decimal ThresholdHighValueUtr);
