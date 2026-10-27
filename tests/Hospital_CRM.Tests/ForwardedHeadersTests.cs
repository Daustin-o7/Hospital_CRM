using System.Net;
using Hospital_CRM.Api.Configuration;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>
/// A client that can forge X-Forwarded-For shapes the rate-limit partition, the audit IP and the
/// platform-admin allowlist, so the proxy list must come from configuration and must stay empty
/// (loopback only) when it is not configured.
/// </summary>
public class ForwardedHeadersTests
{
    private static Microsoft.AspNetCore.Builder.ForwardedHeadersOptions Options(params (string Key, string Value)[] values)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value))
            .Build();
        return ForwardedProxies.Build(config);
    }

    [Fact]
    public void KnownProxies_AreParsedFromConfiguration()
    {
        var options = Options(("ForwardedHeaders:KnownProxies:0", " 172.17.0.1 "));

        Assert.Contains(IPAddress.Parse("172.17.0.1"), options.KnownProxies);
        Assert.DoesNotContain(IPAddress.Any, options.KnownProxies);
    }

    [Fact]
    public void KnownProxies_StayLoopbackOnly_WhenNotConfigured()
    {
        var options = Options();

        Assert.Equal([IPAddress.IPv6Loopback], options.KnownProxies);
    }
}
