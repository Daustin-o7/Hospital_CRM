using Hospital_CRM.Domain.Enums;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>
/// "Users"."Role" stores the enum as an int. Renumbering a member silently rewrites
/// every existing user's role (an inserted Owner once turned every doctor into an owner),
/// so the ordinals are frozen here and new members may only be appended.
/// </summary>
public class UserRolePersistenceTests
{
    [Fact]
    public void Persisted_Ordinals_Are_Append_Only()
    {
        Assert.Equal(0, (int)UserRole.ClinicAdmin);
        Assert.Equal(1, (int)UserRole.Doctor);
        Assert.Equal(2, (int)UserRole.Receptionist);
        Assert.Equal(3, (int)UserRole.PlatformAdmin);
        Assert.Equal(4, (int)UserRole.Pharmacist);
        Assert.Equal(5, (int)UserRole.Nurse);
        Assert.Equal(6, (int)UserRole.Owner);
    }
}
