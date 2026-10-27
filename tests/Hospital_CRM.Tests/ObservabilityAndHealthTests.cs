using Hospital_CRM.Api.Middlewares;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Hospital_CRM.Tests;

public class ObservabilityAndHealthTests
{
    [Fact]
    public async Task CorrelationIdMiddleware_Preserves_Incoming_XCorrelationId()
    {
        // Arrange
        var expectedCorrelationId = "custom-trace-uuid-12345";
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationIdMiddleware.CorrelationHeaderName] = expectedCorrelationId;

        var invoked = false;
        var middleware = new CorrelationIdMiddleware(next: ctx =>
        {
            invoked = true;
            Assert.Equal(expectedCorrelationId, ctx.TraceIdentifier);
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.True(invoked);
        Assert.Equal(expectedCorrelationId, context.TraceIdentifier);
    }

    [Fact]
    public async Task CorrelationIdMiddleware_Accepts_XRequestId_Fallback()
    {
        // Arrange
        var expectedRequestId = "req-fallback-abc-987";
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationIdMiddleware.AltHeaderName] = expectedRequestId;

        var invoked = false;
        var middleware = new CorrelationIdMiddleware(next: ctx =>
        {
            invoked = true;
            Assert.Equal(expectedRequestId, ctx.TraceIdentifier);
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.True(invoked);
        Assert.Equal(expectedRequestId, context.TraceIdentifier);
    }

    [Fact]
    public async Task CorrelationIdMiddleware_Generates_Fresh_Guid_When_Missing()
    {
        // Arrange
        var context = new DefaultHttpContext();

        var invoked = false;
        string? assignedId = null;
        var middleware = new CorrelationIdMiddleware(next: ctx =>
        {
            invoked = true;
            assignedId = ctx.TraceIdentifier;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.True(invoked);
        Assert.NotNull(assignedId);
        Assert.True(Guid.TryParse(assignedId, out _), "Expected generated correlation ID to be a valid GUID");
    }

    [Fact]
    public async Task CorrelationIdMiddleware_Sanitizes_Excessive_Length_Header()
    {
        // Arrange
        var excessiveHeader = new string('A', 200);
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationIdMiddleware.CorrelationHeaderName] = excessiveHeader;

        var middleware = new CorrelationIdMiddleware(next: ctx => Task.CompletedTask);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.NotEqual(excessiveHeader, context.TraceIdentifier);
        Assert.True(Guid.TryParse(context.TraceIdentifier, out _));
    }
}
