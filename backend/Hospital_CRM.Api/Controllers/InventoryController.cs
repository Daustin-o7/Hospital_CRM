using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/inventory")]
public class InventoryController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public InventoryController(HospitalCrmDbContext db) => _db = db;

    // ----- FR-09-01: Manage Item Catalog -----

    [HttpGet("items")]
    [AuthorizeRoles("ClinicAdmin", "Receptionist", "Doctor")]
    public async Task<IActionResult> ListItems([FromQuery] bool? activeOnly, CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var query = _db.InventoryItems.Where(i => i.TenantId == tenantId);
        if (activeOnly ?? true) query = query.Where(i => i.Active);

        var items = await query
            .OrderBy(i => i.Name)
            .Select(i => new
            {
                id = i.Id,
                name = i.Name,
                tier = i.Tier.ToString().ToLower(),
                unit = i.Unit,
                active = i.Active,
                lowStockThreshold = i.LowStockThreshold,
                createdAt = i.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost("items")]
    [AuthorizeRoles("ClinicAdmin", "Receptionist")]
    public async Task<IActionResult> CreateItem([FromBody] CreateInventoryItemRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Unit))
            return BadRequest(new { error = "name_and_unit_required" });

        if (!Enum.TryParse<InventoryTier>(request.Tier, true, out var tier))
            return BadRequest(new { error = "invalid_tier" });

        var item = new InventoryItem
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            Name = request.Name,
            Tier = tier,
            Unit = request.Unit,
            LowStockThreshold = request.LowStockThreshold ?? 0,
            Active = true,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.InventoryItems.Add(item);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = item.Id,
            name = item.Name,
            tier = item.Tier.ToString().ToLower(),
            unit = item.Unit,
            lowStockThreshold = item.LowStockThreshold
        });
    }

    [HttpPatch("items/{id:guid}")]
    [AuthorizeRoles("ClinicAdmin", "Receptionist")]
    public async Task<IActionResult> UpdateItem(Guid id, [FromBody] UpdateInventoryItemRequest request, CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var item = await _db.InventoryItems.FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);
        if (item is null)
            return NotFound(new { error = "item_not_found" });

        // Soft-deactivate only — historical stock_movements must still reference this row
        if (!string.IsNullOrWhiteSpace(request.Name)) item.Name = request.Name;
        if (!string.IsNullOrWhiteSpace(request.Unit)) item.Unit = request.Unit;
        if (request.LowStockThreshold.HasValue) item.LowStockThreshold = request.LowStockThreshold.Value;
        if (request.Active.HasValue) item.Active = request.Active.Value;
        item.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = item.Id,
            name = item.Name,
            tier = item.Tier.ToString().ToLower(),
            unit = item.Unit,
            active = item.Active,
            lowStockThreshold = item.LowStockThreshold
        });
    }

    // ----- FR-09-02: Record Stock Movement -----

    [HttpPost("items/{id:guid}/movements")]
    [AuthorizeRoles("ClinicAdmin", "Receptionist")]
    public async Task<IActionResult> RecordMovement(Guid id, [FromBody] RecordMovementRequest request, CancellationToken ct)
    {
        if (request.Quantity <= 0)
            return BadRequest(new { error = "quantity_must_be_positive" });

        if (!Enum.TryParse<MovementDirection>(request.Direction, true, out var direction))
            return BadRequest(new { error = "invalid_direction" });

        var tenantId = Guid.Empty;
        var item = await _db.InventoryItems.FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);
        if (item is null)
            return NotFound(new { error = "item_not_found" });

        if (!item.Active)
            return BadRequest(new { error = "item_is_inactive" });

        // FR-09-02 edge case: movement that would take balance negative → WARN, don't hard-block
        // (physical stock corrections happen; a hard block would just get staff to enter fake numbers)
        int? currentBalance = null;
        bool wouldGoNegative = false;
        if (direction == MovementDirection.Out)
        {
            currentBalance = await GetBalanceAsync(item.Id, ct);
            wouldGoNegative = (currentBalance.Value - request.Quantity) < 0;
        }

        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var movement = new StockMovement
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ItemId = id,
            Quantity = request.Quantity,
            Direction = direction,
            Note = request.Note,
            RecordedBy = userId.Value,
            RecordedAt = DateTimeOffset.UtcNow
        };
        _db.StockMovements.Add(movement);
        await _db.SaveChangesAsync(ct);

        // Recompute balance after insert
        var newBalance = await GetBalanceAsync(item.Id, ct);

        return StatusCode(201, new
        {
            movementId = movement.Id,
            itemId = item.Id,
            direction = direction.ToString().ToLower(),
            quantity = movement.Quantity,
            balanceBefore = currentBalance,
            balanceAfter = newBalance,
            wouldGoNegative = wouldGoNegative,
            warning = wouldGoNegative ? "balance_went_negative" : null
        });
    }

    private async Task<int> GetBalanceAsync(Guid itemId, CancellationToken ct)
    {
        var movements = await _db.StockMovements
            .Where(m => m.ItemId == itemId)
            .Select(m => new { m.Direction, m.Quantity })
            .ToListAsync(ct);
        var inQty = movements.Where(m => m.Direction == MovementDirection.In).Sum(m => m.Quantity);
        var outQty = movements.Where(m => m.Direction == MovementDirection.Out).Sum(m => m.Quantity);
        return inQty - outQty;
    }

    [HttpGet("items/{id:guid}/movements")]
    [AuthorizeRoles("ClinicAdmin", "Receptionist", "Doctor")]
    public async Task<IActionResult> ListMovements(Guid id, CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var movements = await _db.StockMovements
            .Where(m => m.TenantId == tenantId && m.ItemId == id)
            .OrderByDescending(m => m.RecordedAt)
            .Select(m => new
            {
                id = m.Id,
                quantity = m.Quantity,
                direction = m.Direction.ToString().ToLower(),
                note = m.Note,
                recordedBy = m.RecordedBy,
                recordedAt = m.RecordedAt
            })
            .ToListAsync(ct);
        return Ok(movements);
    }

    // ----- FR-09-03: Low-Stock Report -----

    [HttpGet("low-stock")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> LowStock(CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var items = await _db.InventoryItems
            .Where(i => i.TenantId == tenantId && i.Active && i.LowStockThreshold > 0)
            .ToListAsync(ct);

        var report = new List<object>();
        foreach (var item in items)
        {
            var balance = await GetBalanceAsync(item.Id, ct);
            if (balance <= item.LowStockThreshold)
            {
                report.Add(new
                {
                    itemId = item.Id,
                    name = item.Name,
                    tier = item.Tier.ToString().ToLower(),
                    unit = item.Unit,
                    balance,
                    lowStockThreshold = item.LowStockThreshold
                });
            }
        }
        return Ok(report);
    }
}

public record CreateInventoryItemRequest(string Name, string Tier, string Unit, int? LowStockThreshold);
public record UpdateInventoryItemRequest(string? Name, string? Unit, int? LowStockThreshold, bool? Active);
public record RecordMovementRequest(int Quantity, string Direction, string? Note);
