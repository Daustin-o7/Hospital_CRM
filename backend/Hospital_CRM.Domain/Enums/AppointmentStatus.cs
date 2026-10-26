namespace Hospital_CRM.Domain.Enums;

public enum AppointmentStatus
{
    Booked = 0,
    Confirmed = 1,
    CheckedIn = 2,
    InNursing = 3,
    InConsultation = 4,
    Completed = 5,
    Cancelled = 6,
    NoShow = 7,
    Parked = 8
}