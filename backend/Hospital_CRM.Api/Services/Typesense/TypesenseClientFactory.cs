using Microsoft.Extensions.Options;
using Typesense;
using Typesense.Setup;

namespace Hospital_CRM.Api.Services.Typesense;

public interface ITypesenseClientFactory
{
    ITypesenseClient Create();
}

/// <summary>
/// Wraps the official Typesense-DotNet client. Single client per app is
/// fine — ITypesenseClient is documented as thread-safe.
/// </summary>
public class TypesenseClientFactory : ITypesenseClientFactory
{
    private readonly ITypesenseClient _client;

    public TypesenseClientFactory(IOptions<TypesenseOptions> options, IHttpClientFactory httpClientFactory)
    {
        var cfg = options.Value;
        var (host, port) = SplitHostPort(cfg.Host);
        var setup = new Config(
            new List<Node> { new Node(host, port, cfg.Protocol) },
            cfg.ApiKey,
            string.Empty);
        
        // TypesenseClient requires IOptions<Config>, wrap our config
        var optionsWrapper = Options.Create(setup);
        _client = new TypesenseClient(optionsWrapper, httpClientFactory.CreateClient("typesense"));
    }

    public ITypesenseClient Create() => _client;

    private static (string Host, string Port) SplitHostPort(string host)
    {
        var stripped = host;
        if (stripped.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
            stripped = stripped.Substring("http://".Length);
        else if (stripped.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            stripped = stripped.Substring("https://".Length);

        var colon = stripped.IndexOf(':');
        if (colon > 0)
            return (stripped.Substring(0, colon), stripped.Substring(colon + 1));
        return (stripped, "8108");
    }
}