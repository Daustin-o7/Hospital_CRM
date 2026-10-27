using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;

namespace Hospital_CRM.Api.Configuration;

/// <summary>
/// A client that can forge X-Forwarded-For shapes the rate-limit partition, the audit IP and the
/// platform-admin allowlist, so only explicitly configured proxies are trusted. Unset means
/// loopback only (the framework default), never "trust everyone".
/// </summary>
public static class ForwardedProxies
{
    public static ForwardedHeadersOptions Build(IConfiguration configuration)
    {
        var options = new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
        };

        foreach (var entry in configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [])
        {
            if (IPAddress.TryParse(entry.Trim(), out var proxy) && !options.KnownProxies.Contains(proxy))
                options.KnownProxies.Add(proxy);
        }

        return options;
    }
}
