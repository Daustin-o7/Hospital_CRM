using System.Text.Json;
using Hospital_CRM.Api.Controllers;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Services;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>
/// Covers the Section 0 rules that are easy to regress: deterministic refresh hashing,
/// scope preservation across refresh, token-family reuse detection, and the module /
/// permission / MFA registries that the gateway leans on.
/// </summary>
public class SectionZeroTests
{
    private class FakeKeyService : IPersistentKeyService
    {
        public string KeySource => "Test";
        public Task LoadAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<byte[]> SignAsync(byte[] data, CancellationToken ct = default) => Task.FromResult(Array.Empty<byte>());
        public RsaSecurityKey GetPrivateKey() => null!;
        public RsaSecurityKey GetPublicKey() => null!;
        public object GetJwks() => new();
    }

    private class FakeHostEnv : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Hospital_CRM";
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    private static HospitalCrmDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase($"SectionZero_{Guid.NewGuid()}")
            .Options;
        return new HospitalCrmDbContext(options);
    }

    private static AuthController CreateController(HospitalCrmDbContext db, IConfiguration? config = null)
    {
        config ??= new ConfigurationBuilder().AddInMemoryCollection().Build();
        var controller = new AuthController(
            db, config, new FakeKeyService(), new FakeHostEnv(),
            new TestSecretProtector(), new FakeEmailSender());

        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        controller.ControllerContext.HttpContext.Response.Body = new MemoryStream();
        return controller;
    }

    private static Tenant ActiveTenant(Guid id) => new()
    {
        Id = id,
        Name = "Clinic",
        SubscriptionStatus = SubscriptionStatus.Active,
        SubscriptionTier = SubscriptionTier.Starter,
        SubscriptionEndsAt = DateTimeOffset.UtcNow.AddMonths(1)
    };

    [Fact]
    public void Refresh_Hash_Is_Deterministic_And_Index_Friendly()
    {
        var raw = "refresh-token-value";

        Assert.Equal(raw.HashRefreshToken(), raw.HashRefreshToken());
        Assert.Equal(64, raw.HashRefreshToken().Length);
        Assert.DoesNotContain(raw, raw.HashRefreshToken());
    }

    [Fact]
    public async Task Failed_Login_Writes_An_Auth_Audit_Row()
    {
        using var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(ActiveTenant(tenantId));
        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Email = "doctor@clinic.com",
            Name = "Dr Audit",
            Role = UserRole.Doctor,
            PasswordHash = "CorrectPass123!".HashPassword()
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var result = await controller.Login(
            new LoginRequest("doctor@clinic.com", "WrongPass123!"), CancellationToken.None);

        Assert.IsType<UnauthorizedObjectResult>(result);

        var audit = await db.AuthAuditLogs.SingleAsync();
        Assert.Equal(AuthEvent.LoginFailed, audit.EventType);
        Assert.Equal("failure", audit.Outcome);
        Assert.Equal("doctor@clinic.com", audit.Email);
    }

    [Fact]
    public async Task Refresh_Keeps_The_Stored_Clinic_Scope_Not_The_Users_Primary()
    {
        using var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var primaryClinic = Guid.NewGuid();
        var selectedClinic = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var raw = "clinic-scoped-refresh-token";

        db.Tenants.Add(ActiveTenant(tenantId));
        db.Users.Add(new User
        {
            Id = userId,
            TenantId = tenantId,
            ClinicId = primaryClinic,
            Email = "multi@clinic.com",
            Name = "Dr Multi",
            Role = UserRole.Doctor,
            PasswordHash = "Password123!".HashPassword()
        });
        db.TenantMemberships.AddRange(
            new TenantMembership
            {
                Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId,
                ClinicId = primaryClinic, Role = UserRole.Doctor, Status = "active"
            },
            new TenantMembership
            {
                Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId,
                ClinicId = selectedClinic, Role = UserRole.Doctor, Status = "active"
            });
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TenantId = tenantId,
            ClinicId = selectedClinic,
            Role = UserRole.Doctor,
            FamilyId = Guid.NewGuid(),
            TokenHash = raw.HashRefreshToken(),
            IssuedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var result = await controller.Refresh(new RefreshRequest(raw), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        using var body = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value));
        Assert.Equal(tenantId, body.RootElement.GetProperty("tenantId").GetGuid());
        Assert.Equal(selectedClinic, body.RootElement.GetProperty("clinicId").GetGuid());

        var issued = await db.RefreshTokens.SingleAsync(t => t.TokenHash != raw.HashRefreshToken());
        Assert.Equal(tenantId, issued.TenantId);
        Assert.Equal(selectedClinic, issued.ClinicId);
        Assert.Equal(UserRole.Doctor, issued.Role);
    }

    [Fact]
    public async Task Presented_Revoked_Refresh_Token_Revokes_The_Whole_Family()
    {
        using var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var familyId = Guid.NewGuid();
        var reused = "already-rotated-token";
        var live = "live-family-token";

        db.Tenants.Add(ActiveTenant(tenantId));
        db.Users.Add(new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = "doctor@clinic.com",
            Name = "Dr Reuse",
            Role = UserRole.Doctor,
            PasswordHash = "Password123!".HashPassword()
        });
        db.RefreshTokens.AddRange(
            new RefreshToken
            {
                Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId,
                Role = UserRole.Doctor, FamilyId = familyId,
                TokenHash = reused.HashRefreshToken(),
                IssuedAt = DateTimeOffset.UtcNow.AddMinutes(-1),
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
                RevokedAt = DateTimeOffset.UtcNow
            },
            new RefreshToken
            {
                Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId,
                Role = UserRole.Doctor, FamilyId = familyId,
                TokenHash = live.HashRefreshToken(),
                IssuedAt = DateTimeOffset.UtcNow,
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
            });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var result = await controller.Refresh(new RefreshRequest(reused), CancellationToken.None);

        Assert.IsType<UnauthorizedObjectResult>(result);
        var remaining = await db.RefreshTokens.SingleAsync(t => t.TokenHash == live.HashRefreshToken());
        Assert.NotNull(remaining.RevokedAt);
        Assert.True(await db.AuthAuditLogs.AnyAsync(a => a.EventType == AuthEvent.RefreshReuseDetected));
    }

    [Theory]
    [InlineData("core,pharmacy", ModuleRegistry.Pharmacy, false)]
    [InlineData("core,pharmacy,inventory", ModuleRegistry.Pharmacy, true)]
    [InlineData("core,inventory", ModuleRegistry.Pharmacy, false)]
    [InlineData("core,inventory", ModuleRegistry.Inventory, true)]
    public void Module_Dependencies_Are_Enforced_On_Top_Of_Entitlement(
        string activated, string module, bool expected)
    {
        var entitled = ModuleRegistry.Parse(activated);

        Assert.Equal(expected, ModuleRegistry.IsEntitled(entitled, module));
    }

    [Fact]
    public void Money_And_Clinical_Permissions_Are_Not_Granted_To_Every_Role()
    {
        Assert.True(Permissions.RoleHasPermission(UserRole.Doctor, Permissions.ConsultationWrite));
        Assert.False(Permissions.RoleHasPermission(UserRole.Receptionist, Permissions.ConsultationWrite));
        Assert.False(Permissions.RoleHasPermission(UserRole.Nurse, Permissions.PaymentRecord));
        Assert.True(Permissions.RoleHasPermission(UserRole.Receptionist, Permissions.PaymentRecord));
        Assert.False(Permissions.RoleHasPermission(UserRole.Doctor, Permissions.LedgerWrite));
    }

    [Theory]
    [InlineData(UserRole.Doctor, true)]
    [InlineData(UserRole.ClinicAdmin, true)]
    [InlineData(UserRole.PlatformAdmin, true)]
    [InlineData(UserRole.Receptionist, true)]
    [InlineData(UserRole.Nurse, false)]
    public void Mfa_Enrolment_Is_Mandatory_For_Privileged_Roles(UserRole role, bool expected)
    {
        Assert.Equal(expected, MfaPolicy.RequiresEnrolment(role));
    }

    [Fact]
    public async Task Login_Gates_Mfa_On_The_Clinic_Role_Not_The_Account_Primary_Role()
    {
        using var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        db.Tenants.Add(ActiveTenant(tenantId));
        // Primary role is Nurse (no MFA), but this membership is an admin at the clinic.
        db.Users.Add(new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = "nurse-admin@clinic.com",
            Name = "Nurse Admin",
            Role = UserRole.Nurse,
            PasswordHash = "Password123!".HashPassword()
        });
        db.TenantMemberships.Add(new TenantMembership
        {
            Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId,
            Role = UserRole.ClinicAdmin, Status = "active", IsDefault = true
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db);
        var result = await controller.Login(
            new LoginRequest("nurse-admin@clinic.com", "Password123!"), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        using var body = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value));
        Assert.True(body.RootElement.GetProperty("mfaEnrolmentRequired").GetBoolean());
        Assert.True(body.RootElement.GetProperty("mfaRequiredForRole").GetBoolean());
    }

    [Fact]
    public async Task Login_Skips_The_Mfa_Enrolment_Gate_When_Development_Turns_It_Off()
    {
        using var db = CreateInMemoryDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        db.Tenants.Add(ActiveTenant(tenantId));
        db.Users.Add(new User
        {
            Id = userId,
            TenantId = tenantId,
            Email = "doctor@clinic.com",
            Name = "Dr. Dev",
            Role = UserRole.Doctor,
            PasswordHash = "Password123!".HashPassword()
        });
        db.TenantMemberships.Add(new TenantMembership
        {
            Id = Guid.NewGuid(), UserId = userId, TenantId = tenantId,
            Role = UserRole.Doctor, Status = "active", IsDefault = true
        });
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Mfa:RequireEnrolment"] = "false" })
            .Build();

        var result = await CreateController(db, config).Login(
            new LoginRequest("doctor@clinic.com", "Password123!"), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        using var body = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value));
        Assert.False(body.RootElement.GetProperty("mfaEnrolmentRequired").GetBoolean());
        Assert.False(body.RootElement.GetProperty("mfaRequiredForRole").GetBoolean());
    }
}
