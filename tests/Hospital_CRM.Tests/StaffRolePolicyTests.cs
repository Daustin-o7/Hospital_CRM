using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Enums;
using Xunit;

namespace Hospital_CRM.Tests;

public class StaffRolePolicyTests
{
    [Fact]
    public void Normal_Invite_Rejects_ClinicAdmin()
    {
        Assert.False(StaffRolePolicy.TryParseInvitableRole("ClinicAdmin", allowClinicAdmin: false, out _));
    }

    [Fact]
    public void Provisioning_Allows_ClinicAdmin()
    {
        Assert.True(StaffRolePolicy.TryParseInvitableRole("ClinicAdmin", allowClinicAdmin: true, out var role));
        Assert.Equal(UserRole.ClinicAdmin, role);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("1")]
    [InlineData("99")]
    public void Numeric_Roles_Are_Rejected(string raw)
    {
        Assert.False(StaffRolePolicy.TryParseInvitableRole(raw, allowClinicAdmin: true, out _));
    }

    [Fact]
    public void PlatformAdmin_Is_Never_Invitable()
    {
        Assert.False(StaffRolePolicy.TryParseInvitableRole("PlatformAdmin", allowClinicAdmin: true, out _));
    }

    [Theory]
    [InlineData("doctor", UserRole.Doctor)]
    [InlineData("NURSE", UserRole.Nurse)]
    [InlineData("Receptionist", UserRole.Receptionist)]
    [InlineData("Pharmacist", UserRole.Pharmacist)]
    public void Valid_Roles_Are_Case_Insensitive(string raw, UserRole expected)
    {
        Assert.True(StaffRolePolicy.TryParseInvitableRole(raw, allowClinicAdmin: false, out var role));
        Assert.Equal(expected, role);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("superuser")]
    public void Unknown_Or_Empty_Roles_Are_Rejected(string raw)
    {
        Assert.False(StaffRolePolicy.TryParseInvitableRole(raw, allowClinicAdmin: true, out _));
    }
}
