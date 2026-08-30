namespace Hospital_CRM.Domain.Enums;

public enum InventoryTier
{
    Dead = 0,        // Capital equipment (depreciates, not consumed)
    Consumable = 1,  // Used up (gloves, syringes, medicines)
    Usable = 2       // Reusable (instruments, bed sheets)
}

public enum MovementDirection
{
    In = 0,
    Out = 1
}
