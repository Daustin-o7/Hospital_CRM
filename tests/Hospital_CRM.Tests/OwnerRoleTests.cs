using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Enums;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>
/// The Owner runs the clinic, so it reaches every ClinicAdmin area and inherits the ClinicAdmin
/// capabilities there — without being re-listed in ~160 [AuthorizeRoles] attributes.
/// </summary>
public class OwnerRoleTests
{
    [Fact]
    public void ClinicAdmin_Area_Gate_Also_Admits_Owner()
    {
        Assert.Equal("ClinicAdmin,Owner", new AuthorizeRolesAttribute("ClinicAdmin").Roles);
    }

    [Fact]
    public void Composite_Role_Strings_Are_Expanded_And_Deduplicated()
    {
        var attr = new AuthorizeRolesAttribute(RoleRegistry.ClinicalOrAdmin);

        Assert.Equal("ClinicAdmin,Owner,Doctor,Nurse", attr.Roles);
    }

    [Fact]
    public void Other_Roles_Are_Left_Alone()
    {
        Assert.Equal("Doctor,Receptionist", new AuthorizeRolesAttribute("Doctor", "Receptionist").Roles);
    }

    [Theory]
    [InlineData(Permissions.PatientsRead)]
    [InlineData(Permissions.PatientWrite)]
    [InlineData(Permissions.VitalsWrite)]
    [InlineData(Permissions.InvoiceWrite)]
    [InlineData(Permissions.PaymentRecord)]
    [InlineData(Permissions.PharmacyDispense)]
    [InlineData(Permissions.LedgerWrite)]
    public void Owner_Matches_ClinicAdmin_Permissions(string permission)
    {
        Assert.True(Permissions.RoleHasPermission(UserRole.ClinicAdmin, permission));
        Assert.True(Permissions.RoleHasPermission(UserRole.Owner, permission));
    }

    [Fact]
    public void Owner_Does_Not_Gain_Doctor_Only_Clinical_Writes()
    {
        Assert.False(Permissions.RoleHasPermission(UserRole.Owner, Permissions.ConsultationWrite));
    }
}
