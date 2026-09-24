using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Hospital_CRM.Api.Controllers;
using Xunit;

namespace Hospital_CRM.Tests;

public class ValidationTests
{
    // Validates via constructor-parameter attributes — the same placement the
    // ASP.NET model binder reads for positional records (property-targeted
    // validation metadata makes .NET 10 throw at request time).
    private static IList<ValidationResult> ValidateModel(object model)
    {
        var validationResults = new List<ValidationResult>();
        var type = model.GetType();
        // Records emit a copy-constructor T(T) alongside the primary one —
        // pick the primary (its params are never the record type itself).
        var ctor = type.GetConstructors()
            .First(c => !(c.GetParameters().Length == 1 && c.GetParameters()[0].ParameterType == type));

        var args = ctor.GetParameters()
            .Select(p => type.GetProperty(p.Name ?? "")?.GetValue(model))
            .ToArray();

        for (var i = 0; i < ctor.GetParameters().Length; i++)
        {
            var parameter = ctor.GetParameters()[i];
            var attributes = parameter.GetCustomAttributes<ValidationAttribute>().ToArray();
            if (attributes.Length == 0) continue;

            var context = new ValidationContext(model, serviceProvider: null, items: null)
            {
                MemberName = parameter.Name
            };
            foreach (var attribute in attributes)
            {
                var result = attribute.GetValidationResult(args[i], context);
                if (result != ValidationResult.Success)
                    validationResults.Add(
                        new ValidationResult(result!.ErrorMessage, new[] { parameter.Name! }));
            }
        }

        return validationResults;
    }

    [Fact]
    public void PatientRegisterRequest_ValidInput_PassesValidation()
    {
        var request = new PatientRegisterRequest(
            Name: "Aarav Sharma",
            Phone: "9876543210",
            Dob: null,
            ApproxAge: 32,
            Gender: "Male",
            Address: null,
            Consent: new ConsentRequest(Accepted: true, Purpose: "care_delivery"),
            IdempotencyKey: "IDEMP-PAT-12345");

        var errors = ValidateModel(request);
        var consentErrors = ValidateModel(request.Consent!);

        Assert.Empty(errors);
        Assert.Empty(consentErrors);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("A")]
    public void PatientRegisterRequest_InvalidName_FailsValidation(string invalidName)
    {
        var request = new PatientRegisterRequest(
            Name: invalidName,
            Phone: "9876543210",
            Dob: null,
            ApproxAge: null,
            Gender: "Male",
            Address: null,
            Consent: new ConsentRequest(Accepted: true, Purpose: null!),
            IdempotencyKey: null);

        var errors = ValidateModel(request);
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(PatientRegisterRequest.Name)));
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("987654321")]
    [InlineData("98765432100")]
    [InlineData("5876543210")]
    [InlineData("abcdefghij")]
    public void PatientRegisterRequest_InvalidPhone_FailsValidation(string invalidPhone)
    {
        var request = new PatientRegisterRequest(
            Name: "Aarav Sharma",
            Phone: invalidPhone,
            Dob: null,
            ApproxAge: null,
            Gender: "Male",
            Address: null,
            Consent: new ConsentRequest(Accepted: true, Purpose: null!),
            IdempotencyKey: null);

        var errors = ValidateModel(request);
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(PatientRegisterRequest.Phone)));
    }

    [Fact]
    public void PatientRegisterRequest_NegativeAge_FailsValidation()
    {
        var request = new PatientRegisterRequest(
            Name: "Aarav Sharma",
            Phone: "9876543210",
            Dob: null,
            ApproxAge: -5,
            Gender: "Male",
            Address: null,
            Consent: new ConsentRequest(Accepted: true, Purpose: null!),
            IdempotencyKey: null);

        var errors = ValidateModel(request);
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(PatientRegisterRequest.ApproxAge)));
    }

    [Fact]
    public void BookAppointmentRequest_ValidTimeslot_PassesValidation()
    {
        var request = new BookAppointmentRequest(
            PatientId: Guid.NewGuid(),
            DoctorId: Guid.NewGuid(),
            Date: "2030-01-15",
            TimeSlot: "10:30",
            Type: "Scheduled");

        var errors = ValidateModel(request);
        Assert.Empty(errors);
    }

    [Theory]
    [InlineData("25:00")]
    [InlineData("10:65")]
    [InlineData("1030")]
    [InlineData("morning")]
    public void BookAppointmentRequest_InvalidTimeSlot_FailsValidation(string invalidTime)
    {
        var request = new BookAppointmentRequest(
            PatientId: Guid.NewGuid(),
            DoctorId: Guid.NewGuid(),
            Date: "2030-01-15",
            TimeSlot: invalidTime,
            Type: "Scheduled");

        var errors = ValidateModel(request);
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(BookAppointmentRequest.TimeSlot)));
    }

    [Fact]
    public void InvoiceLineItemRequest_NonPositiveAmount_FailsValidation()
    {
        var item = new InvoiceLineItemRequest(Description: "Consultation", Amount: -100);

        var errors = ValidateModel(item);
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(InvoiceLineItemRequest.Amount)));
    }

    [Fact]
    public void CreateExpenseRequest_ValidInput_PassesValidation()
    {
        var request = new CreateExpenseRequest(
            Category: "MedicalSupplies",
            CategoryOther: null,
            Amount: 1500.50m,
            ExpenseDate: "2026-01-15",
            Note: "Surgical gloves and masks");

        var errors = ValidateModel(request);
        Assert.Empty(errors);
    }

    [Fact]
    public void CreateExpenseRequest_ZeroAmount_FailsValidation()
    {
        var request = new CreateExpenseRequest(
            Category: "Utilities",
            CategoryOther: null,
            Amount: 0,
            ExpenseDate: "2026-01-15",
            Note: null);

        var errors = ValidateModel(request);
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(CreateExpenseRequest.Amount)));
    }

    [Fact]
    public void CreateConsultationRequest_ShortComplaint_FailsValidation()
    {
        var request = new CreateConsultationRequest(
            ChiefComplaint: "A",
            Observations: null,
            Diagnosis: "Fever",
            PreviousVersionId: null);

        var errors = ValidateModel(request);
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(CreateConsultationRequest.ChiefComplaint)));
    }

    [Fact]
    public void StaffInviteRequest_InvalidEmail_FailsValidation()
    {
        var request = new StaffInviteRequest(Name: "Dr. Priya", Email: "not-an-email", Role: "Doctor");

        var errors = ValidateModel(request);
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(StaffInviteRequest.Email)));
    }

    [Fact]
    public void InwardBatchRequest_InvalidRates_FailsValidation()
    {
        var request = new InwardBatchRequest(
            BatchNumber: "BATCH-001",
            ExpiryDate: "2030-01-15",
            MfgDate: null,
            QuantityReceived: 0,
            Mrp: -50,
            PurchaseRate: -40,
            SupplierId: null);

        var errors = ValidateModel(request);
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(InwardBatchRequest.QuantityReceived)));
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(InwardBatchRequest.Mrp)));
        Assert.Contains(errors, e => e.MemberNames.Contains(nameof(InwardBatchRequest.PurchaseRate)));
    }
}
