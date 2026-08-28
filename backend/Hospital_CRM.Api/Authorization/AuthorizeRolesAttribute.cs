using Microsoft.AspNetCore.Authorization;

namespace Hospital_CRM.Api.Authorization;

public class AuthorizeRolesAttribute : AuthorizeAttribute
{
    public AuthorizeRolesAttribute(params string[] roles)
    {
        Roles = string.Join(",", roles);
        Policy = null;
    }
}
