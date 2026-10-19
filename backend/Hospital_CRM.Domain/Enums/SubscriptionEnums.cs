namespace Hospital_CRM.Domain.Enums;

public enum SubscriptionTier
{
    Trial = 0,
    Starter = 1,
    Professional = 2,
    Enterprise = 3,
    EnterprisePlus = 4,
    Private = 5,
    Suspended = 99  // legacy admin-set, maps to Status.Suspended
}

public enum SubscriptionStatus
{
    Trial = 0,
    Active = 1,
    PastDue = 2,
    Suspended = 3,
    Cancelled = 4
}
