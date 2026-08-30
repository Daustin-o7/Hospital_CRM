using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/wishlist-items")]
public class WishlistItemsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public WishlistItemsController(HospitalCrmDbContext db) => _db = db;

    [HttpGet]
    [AuthorizeRoles("Doctor", "ClinicAdmin")]
    public async Task<IActionResult> List([FromQuery] string? status, CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var query = _db.WishlistItems.Where(w => w.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<WishlistStatus>(status, true, out var statusEnum))
        {
            query = query.Where(w => w.Status == statusEnum);
        }

        var items = await query
            .OrderBy(w => w.Status)
            .ThenByDescending(w => w.CreatedAt)
            .Select(w => new
            {
                id = w.Id,
                text = w.Text,
                category = w.Category.ToString().ToLower(),
                status = w.Status.ToString().ToLower(),
                createdBy = w.CreatedBy,
                createdAt = w.CreatedAt,
                updatedAt = w.UpdatedAt
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost]
    [AuthorizeRoles("Doctor", "ClinicAdmin")]
    public async Task<IActionResult> Create([FromBody] CreateWishlistItemRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(new { error = "text_required" });

        if (!Enum.TryParse<WishlistCategory>(request.Category, true, out var category))
            return BadRequest(new { error = "invalid_category" });

        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var item = new WishlistItem
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            CreatedBy = userId.Value,
            Text = request.Text,
            Category = category,
            Status = WishlistStatus.Open,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.WishlistItems.Add(item);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = item.Id,
            text = item.Text,
            category = item.Category.ToString().ToLower(),
            status = item.Status.ToString().ToLower()
        });
    }

    [HttpPatch("{id:guid}")]
    [AuthorizeRoles("Doctor", "ClinicAdmin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWishlistItemRequest request, CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var item = await _db.WishlistItems.FirstOrDefaultAsync(w => w.Id == id && w.TenantId == tenantId, ct);
        if (item is null)
            return NotFound(new { error = "item_not_found" });

        if (!string.IsNullOrWhiteSpace(request.Text))
            item.Text = request.Text;

        if (!string.IsNullOrWhiteSpace(request.Category) &&
            Enum.TryParse<WishlistCategory>(request.Category, true, out var category))
            item.Category = category;

        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<WishlistStatus>(request.Status, true, out var status))
            item.Status = status;

        item.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = item.Id,
            text = item.Text,
            category = item.Category.ToString().ToLower(),
            status = item.Status.ToString().ToLower()
        });
    }
}

public record CreateWishlistItemRequest(string Text, string Category);
public record UpdateWishlistItemRequest(string? Text, string? Category, string? Status);
