using Hospital_CRM.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Hospital_CRM.Api;

public sealed class JwtBearerOptionsConfig(IPersistentKeyService keyService) : IPostConfigureOptions<JwtBearerOptions>
{
    public void PostConfigure(string? name, JwtBearerOptions options)
    {
        options.TokenValidationParameters ??= new TokenValidationParameters();
        options.TokenValidationParameters.IssuerSigningKey ??= keyService.GetPublicKey();
    }
}
