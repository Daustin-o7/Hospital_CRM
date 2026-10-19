using Hospital_CRM.Domain.Constants;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>A2: the module set round-trips between the stored comma string and a string[].</summary>
public class ModuleRegistryTests
{
    [Theory]
    [InlineData(null, new string[0])]
    [InlineData("", new string[0])]
    [InlineData("   ", new string[0])]
    [InlineData("core", new[] { "core" })]
    [InlineData("core,pharmacy", new[] { "core", "pharmacy" })]
    [InlineData(" Core , PHARMACY ", new[] { "core", "pharmacy" })]
    [InlineData("core,core,pharmacy,pharmacy", new[] { "core", "pharmacy" })]
    [InlineData("core,,pharmacy,", new[] { "core", "pharmacy" })]
    public void Parse_normalises_whitespace_case_and_duplicates(string? stored, string[] expected)
    {
        Assert.Equal(expected, ModuleRegistry.Parse(stored));
    }

    [Theory]
    [InlineData(null, "")]
    [InlineData("core", "core")]
    [InlineData("core,pharmacy", "core,pharmacy")]
    public void Serialize_round_trips_through_Parse(string? stored, string expected)
    {
        Assert.Equal(expected, ModuleRegistry.Serialize(ModuleRegistry.Parse(stored)));
    }

    [Fact]
    public void Serialize_normalises_input_order_sensitive_values()
    {
        Assert.Equal("core,pharmacy", ModuleRegistry.Serialize([" PHARMACY ", "core", "core"]));
    }

    [Theory]
    [InlineData("core", true)]
    [InlineData("pharmacy", true)]
    [InlineData(" PHARMACY ", true)]
    [InlineData("nope", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsKnown_accepts_only_registered_codes(string? code, bool expected)
    {
        Assert.Equal(expected, ModuleRegistry.IsKnown(code));
    }
}
