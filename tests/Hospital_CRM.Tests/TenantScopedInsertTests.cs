using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Services;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hospital_CRM.Tests;

public class TenantScopedInsertTests
{
    private sealed class TestTenantContext : ITenantContext
    {
        public Guid? CurrentTenantId { get; set; }
        public bool IsPlatformAdmin { get; set; }

        public IDisposable PushTenant(Guid tenantId)
        {
            var prior = CurrentTenantId;
            CurrentTenantId = tenantId;
            return new Restore(() => CurrentTenantId = prior);
        }

        private sealed class Restore(Action onDispose) : IDisposable
        {
            public void Dispose() => onDispose();
        }
    }

    private static HospitalCrmDbContext CreateInMemoryDb(ITenantContext? tenantContext = null)
    {
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new HospitalCrmDbContext(options, tenantContext);
    }

    [Fact]
    public async Task Insert_ITenantScoped_With_GuidEmpty_Automatically_Stamps_Ambient_TenantId()
    {
        var ambientTenantId = Guid.NewGuid();
        var tenantContext = new TestTenantContext { CurrentTenantId = ambientTenantId };
        using var db = CreateInMemoryDb(tenantContext);

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            Name = "John Doe",
            Phone = "9876543210",
            Gender = Domain.Enums.Gender.Male,
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.Patients.Add(patient);
        await db.SaveChangesAsync();

        Assert.Equal(ambientTenantId, patient.TenantId);
    }

    [Fact]
    public async Task Insert_ITenantScoped_With_Explicit_TenantId_Preserves_Explicit_TenantId()
    {
        var ambientTenantId = Guid.NewGuid();
        var explicitTenantId = Guid.NewGuid();
        var tenantContext = new TestTenantContext { CurrentTenantId = ambientTenantId };
        using var db = CreateInMemoryDb(tenantContext);

        var expense = new LedgerExpense
        {
            Id = Guid.NewGuid(),
            TenantId = explicitTenantId,
            Category = Domain.Enums.ExpenseCategory.Rent,
            CategoryOther = "Rent",
            Amount = 5000,
            ExpenseDate = new DateOnly(2026, 10, 19),
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.LedgerExpenses.Add(expense);
        await db.SaveChangesAsync();

        Assert.Equal(explicitTenantId, expense.TenantId);
    }

    [Fact]
    public async Task Insert_ITenantScoped_Without_Ambient_Tenant_Leaves_TenantId_As_Is()
    {
        using var db = CreateInMemoryDb(new TestTenantContext { CurrentTenantId = null });

        var item = new InventoryItem
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            Name = "Bandage",
            Unit = "box",
            Tier = Domain.Enums.InventoryTier.Consumable,
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.InventoryItems.Add(item);
        await db.SaveChangesAsync();

        Assert.Equal(Guid.Empty, item.TenantId);
    }

    [Fact]
    public async Task Query_TenantScoped_OnlyReturns_CurrentTenant_Entities()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var context = new TestTenantContext { CurrentTenantId = tenantA, IsPlatformAdmin = false };

        var dbName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        using (var dbSeed = new HospitalCrmDbContext(options, new TestTenantContext { IsPlatformAdmin = true }))
        {
            dbSeed.Patients.Add(new Patient
            {
                Id = Guid.NewGuid(),
                TenantId = tenantA,
                Name = "Patient Tenant A",
                Phone = "1111111111",
                Gender = Domain.Enums.Gender.Male,
                CreatedAt = DateTimeOffset.UtcNow
            });
            dbSeed.Patients.Add(new Patient
            {
                Id = Guid.NewGuid(),
                TenantId = tenantB,
                Name = "Patient Tenant B",
                Phone = "2222222222",
                Gender = Domain.Enums.Gender.Female,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await dbSeed.SaveChangesAsync();
        }

        using (var dbQuery = new HospitalCrmDbContext(options, context))
        {
            var patients = await dbQuery.Patients.ToListAsync();
            Assert.Single(patients);
            Assert.Equal(tenantA, patients[0].TenantId);
            Assert.Equal("Patient Tenant A", patients[0].Name);
        }
    }

    [Fact]
    public async Task Query_TenantScoped_PlatformAdmin_Returns_All_Tenants_Entities()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var adminContext = new TestTenantContext { CurrentTenantId = null, IsPlatformAdmin = true };

        var dbName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        using (var dbSeed = new HospitalCrmDbContext(options, adminContext))
        {
            dbSeed.Patients.Add(new Patient
            {
                Id = Guid.NewGuid(),
                TenantId = tenantA,
                Name = "Patient A",
                Phone = "111",
                Gender = Domain.Enums.Gender.Male,
                CreatedAt = DateTimeOffset.UtcNow
            });
            dbSeed.Patients.Add(new Patient
            {
                Id = Guid.NewGuid(),
                TenantId = tenantB,
                Name = "Patient B",
                Phone = "222",
                Gender = Domain.Enums.Gender.Female,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await dbSeed.SaveChangesAsync();
        }

        using (var dbQuery = new HospitalCrmDbContext(options, adminContext))
        {
            var patients = await dbQuery.Patients.ToListAsync();
            Assert.Equal(2, patients.Count);
        }
    }

    [Fact]
    public async Task Query_TenantScoped_IgnoreQueryFilters_Returns_All_Entities()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var context = new TestTenantContext { CurrentTenantId = tenantA, IsPlatformAdmin = false };

        var dbName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        using (var dbSeed = new HospitalCrmDbContext(options, new TestTenantContext { IsPlatformAdmin = true }))
        {
            dbSeed.Patients.Add(new Patient { Id = Guid.NewGuid(), TenantId = tenantA, Name = "A", Phone = "1", Gender = Domain.Enums.Gender.Other, CreatedAt = DateTimeOffset.UtcNow });
            dbSeed.Patients.Add(new Patient { Id = Guid.NewGuid(), TenantId = tenantB, Name = "B", Phone = "2", Gender = Domain.Enums.Gender.Other, CreatedAt = DateTimeOffset.UtcNow });
            await dbSeed.SaveChangesAsync();
        }

        using (var dbQuery = new HospitalCrmDbContext(options, context))
        {
            var allPatients = await dbQuery.Patients.IgnoreQueryFilters().ToListAsync();
            Assert.Equal(2, allPatients.Count);
        }
    }
}
