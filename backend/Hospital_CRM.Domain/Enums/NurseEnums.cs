namespace Hospital_CRM.Domain.Enums;

public enum ShiftType
{
    Morning,
    Evening,
    Night
}

public enum ShiftStatus
{
    Open,
    Assigned,
    Cancelled
}

public enum ShiftApplicationStatus
{
    Applied,
    Selected,
    Rejected,
    Withdrawn
}

public enum LeaveType
{
    Sick,
    Casual,
    Vacation,
    Unpaid
}

public enum LeaveStatus
{
    Pending,
    Approved,
    Rejected,
    Cancelled
}

public enum NurseAssignmentStatus
{
    Active,
    Completed,
    Cancelled
}
