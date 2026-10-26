using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hospital_CRM.Api.Extensions;

public static class DbUpdateExceptionExtensions
{
    /// <summary>
    /// True when the database rejected the write with a unique-constraint violation
    /// (Postgres SQLSTATE 23505). Callers turn this into 409 instead of a 500.
    /// </summary>
    public static bool IsUniqueViolation(this DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
