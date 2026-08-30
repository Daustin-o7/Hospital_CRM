namespace Hospital_CRM.Domain.Enums;

public enum SubscriptionTier
{
    Trial = 0,
    Starter = 1,
    Professional = 2,
    Enterprise = 3,
    Suspended = 99  // admin-set, blocks tenant logins
}

public enum SubscriptionStatus
{
    Active = 0,
    PastDue = 1,
    Cancelled = 2,
    Suspended = 3
}
