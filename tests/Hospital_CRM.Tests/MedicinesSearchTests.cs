using System.Security.Claims;
using System.Text.Json;
using Hospital_CRM.Api.Controllers;
using Hospital_CRM.Api.Services.Typesense;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Typesense;
using Xunit;

namespace Hospital_CRM.Tests;

public class MedicinesSearchTests
{
    private HospitalCrmDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<HospitalCrmDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new HospitalCrmDbContext(options);
    }

    [Fact]
    public async Task Search_Returns_EmptyArray_WhenQueryBlank()
    {
        var searchService = new FakePatientSearchService();
        var controller = new MedicinesController(searchService, NullLogger<MedicinesController>.Instance);

        var claims = new[] { new Claim("sub", Guid.NewGuid().ToString()), new Claim("role", "Doctor") };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        var result = await controller.Search("", 10, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task Search_CallsService_AndMapsFieldsCorrectly()
    {
        var expectedId = Guid.NewGuid();
        var searchService = new MockMedicineSearchService(new List<MedicineSearchHit>
        {
            new(
                Id: expectedId,
                Name: "Paracetamol 650mg",
                GenericName: "Paracetamol / Acetaminophen",
                CommonBrands: "Dolo 650, Calpol",
                Strength: "650mg",
                DosageForm: "Tablet",
                Score: 100
            )
        });

        var controller = new MedicinesController(searchService, NullLogger<MedicinesController>.Instance);

        var claims = new[] { new Claim("sub", Guid.NewGuid().ToString()), new Claim("role", "Doctor") };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        var result = await controller.Search("dolo", 10, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = JsonSerializer.Serialize(okResult.Value);
        var items = JsonSerializer.Deserialize<List<JsonElement>>(json)!;

        Assert.Single(items);
        Assert.Equal(expectedId.ToString(), items[0].GetProperty("id").GetString());
        Assert.Equal("Paracetamol 650mg", items[0].GetProperty("name").GetString());
        Assert.Equal("Paracetamol / Acetaminophen", items[0].GetProperty("genericName").GetString());
        Assert.Equal("Dolo 650, Calpol", items[0].GetProperty("commonBrands").GetString());
        Assert.Equal("650mg", items[0].GetProperty("strength").GetString());
        Assert.Equal("Tablet", items[0].GetProperty("dosageForm").GetString());
    }
}

public class MockMedicineSearchService : FakePatientSearchService
{
    private readonly List<MedicineSearchHit> _hits;

    public MockMedicineSearchService(List<MedicineSearchHit> hits)
    {
        _hits = hits;
    }

    public override Task<List<MedicineSearchHit>> MedicinesSearchAsync(string query, Guid tenantId, int limit = 10, CancellationToken ct = default)
    {
        return Task.FromResult(_hits);
    }
}
