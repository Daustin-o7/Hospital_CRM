using System.Globalization;
using System.Text;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Utils;
using QRCoder;

namespace Hospital_CRM.Api.Services;

public interface IPdfService
{
    byte[] GeneratePrescriptionPdf(Prescription prescription, Consultation consultation, Clinic? clinic, bool isDuplicate);
    byte[] GenerateInvoicePdf(Invoice invoice, Clinic? clinic, bool isDuplicate);
    byte[] GenerateCreditNotePdf(CreditNote creditNote, Invoice invoice, Clinic? clinic);
}

public class PdfService : IPdfService
{
    public byte[] GeneratePrescriptionPdf(Prescription prescription, Consultation consultation, Clinic? clinic, bool isDuplicate)
    {
        var canvas = new PdfCanvas();

        // 1. Watermark if duplicate
        if (isDuplicate)
        {
            canvas.DrawWatermark("DUPLICATE COPY");
        }

        // 2. Clinic Header
        float y = 800;
        var clinicName = clinic?.LegalName ?? clinic?.Name ?? "HOSPITAL CLINIC & MEDICAL CENTRE";
        canvas.DrawText(clinicName, 40, y, 16, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);
        y -= 15;

        var clinicSub = $"{clinic?.Address ?? "Clinical Healthcare Services"} | Phone: {clinic?.Phone ?? "N/A"}";
        canvas.DrawText(clinicSub, 40, y, 9, bold: false, r: 0.35f, g: 0.35f, b: 0.35f);
        y -= 12;

        if (!string.IsNullOrWhiteSpace(clinic?.PharmacyLicenceNumber20) || !string.IsNullOrWhiteSpace(clinic?.PharmacyLicenceNumber21))
        {
            var lic = $"Retail Drug Lic: Form 20: {clinic.PharmacyLicenceNumber20 ?? "N/A"}, Form 21: {clinic.PharmacyLicenceNumber21 ?? "N/A"}";
            canvas.DrawText(lic, 40, y, 8, bold: false, r: 0.45f, g: 0.45f, b: 0.45f);
            y -= 12;
        }

        canvas.DrawLine(40, y, 555, y, 0.2f, 0.4f, 0.6f, 1.5f);
        y -= 20;

        // 3. Doctor Details (Left) & Document Title (Right)
        var doctorName = consultation.Doctor?.Name ?? "Treating Doctor";
        canvas.DrawText($"DR. {doctorName.ToUpperInvariant()}", 40, y, 12, bold: true, r: 0.1f, g: 0.1f, b: 0.1f);
        canvas.DrawRightAlignedText("ELECTRONIC PRESCRIPTION", 555, y, 12, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);
        y -= 14;

        var doctorQual = $"{consultation.DoctorQualifications ?? "MBBS"} | Reg No: {consultation.DoctorRegistrationNumber ?? "NMC/SMC Registered"}";
        canvas.DrawText(doctorQual, 40, y, 9, bold: false, r: 0.3f, g: 0.3f, b: 0.3f);
        var rxDate = (consultation.SignedAt ?? consultation.CreatedAt).ToString("dd-MMM-yyyy HH:mm");
        canvas.DrawRightAlignedText($"Date: {rxDate} | Version: {consultation.Version}", 555, y, 9, bold: false, r: 0.3f, g: 0.3f, b: 0.3f);
        y -= 18;

        // 4. Patient Information Box
        canvas.DrawRect(40, y - 40, 515, 45, 0.95f, 0.97f, 0.99f, fill: true);
        canvas.DrawRect(40, y - 40, 515, 45, 0.8f, 0.85f, 0.9f, fill: false);

        var patient = consultation.Appointment?.Patient;
        var patientName = patient?.Name ?? "Walk-in Patient";
        var uhid = patient?.Uhid ?? "N/A";
        var ageGender = $"Age: {patient?.ApproxAge?.ToString() ?? "N/A"} | Gender: {patient?.Gender.ToString() ?? "N/A"}";
        var phone = $"Phone: {patient?.Phone ?? "N/A"}";

        canvas.DrawText($"Patient Name: {patientName}", 50, y - 14, 9, bold: true);
        canvas.DrawText($"UHID: {uhid}", 250, y - 14, 9, bold: true);
        canvas.DrawRightAlignedText(phone, 545, y - 14, 9, bold: false);

        canvas.DrawText(ageGender, 50, y - 30, 9, bold: false);
        var address = $"Address: {patient?.Address ?? "Local"}";
        canvas.DrawText(address, 250, y - 30, 9, bold: false);
        y -= 55;

        // 5. Clinical Diagnosis
        if (!string.IsNullOrWhiteSpace(consultation.Diagnosis))
        {
            canvas.DrawText("DIAGNOSIS / CLINICAL FINDINGS:", 40, y, 9, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);
            y -= 14;
            canvas.DrawText(consultation.Diagnosis, 50, y, 9, bold: false, r: 0.1f, g: 0.1f, b: 0.1f);
            y -= 20;
        }

        // 6. Rx Medicines Table Header
        canvas.DrawText("Rx (MEDICATIONS)", 40, y, 12, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);
        y -= 16;

        canvas.DrawRect(40, y - 14, 515, 18, 0.12f, 0.30f, 0.50f, fill: true);
        canvas.DrawText("#", 45, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawText("MEDICINE & STRENGTH", 65, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawText("FORM", 240, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawText("FREQUENCY", 300, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawText("DURATION", 380, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawText("TIMING / INSTRUCTIONS", 450, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        y -= 20;

        // 7. Rx Items Rows
        int itemIndex = 1;
        foreach (var item in prescription.Items)
        {
            var medName = !string.IsNullOrWhiteSpace(item.BrandName)
                ? $"{item.BrandName} ({item.GenericName})"
                : item.MedicineText;

            canvas.DrawText(itemIndex.ToString(), 45, y, 8, bold: false);
            canvas.DrawText(medName, 65, y, 8, bold: true);
            canvas.DrawText($"{item.DosageForm} {item.Strength}".Trim(), 240, y, 8, bold: false);
            canvas.DrawText(item.Frequency ?? "1-0-1", 300, y, 8, bold: false);
            canvas.DrawText($"{item.Duration} {item.DurationUnit}", 380, y, 8, bold: false);
            var timing = $"{item.Timing} {(string.IsNullOrWhiteSpace(item.SpecialInstructions) ? "" : " - " + item.SpecialInstructions)}".Trim();
            canvas.DrawText(timing, 450, y, 8, bold: false);

            canvas.DrawLine(40, y - 4, 555, y - 4, 0.9f, 0.9f, 0.9f, 0.5f);
            y -= 16;
            itemIndex++;

            if (y < 160) break; // Keep space for signature and QR footer
        }

        // 8. Bottom Footer with Digital Signature & Real QR Verification Code
        float footerY = 130;
        canvas.DrawLine(40, footerY + 10, 555, footerY + 10, 0.8f, 0.8f, 0.8f, 1f);

        // Verification QR code (links to /rx-verify/{code}?v={version})
        var qrCodeValue = consultation.VerificationQrCode ?? prescription.Id.ToString("N");
        var qrUrl = $"/rx-verify/{qrCodeValue}?v={consultation.Version}";
        canvas.DrawQrCode(qrUrl, 40, footerY - 80, 80);

        canvas.DrawText("VERIFY RX AUTHENTICITY", 130, footerY - 5, 9, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);
        canvas.DrawText($"Code: {qrCodeValue}", 130, footerY - 18, 8, bold: false, mono: true, r: 0.2f, g: 0.2f, b: 0.2f);
        canvas.DrawText("Scan with any mobile camera to verify signed digital copy on clinic portal.", 130, footerY - 30, 8, bold: false, r: 0.4f, g: 0.4f, b: 0.4f);

        // Digital Signature Hash
        if (!string.IsNullOrWhiteSpace(consultation.DigitalSignatureHash))
        {
            canvas.DrawText("SHA-256 DIGITAL SIGNATURE HASH:", 130, footerY - 48, 7, bold: true, r: 0.3f, g: 0.3f, b: 0.3f);
            canvas.DrawText(consultation.DigitalSignatureHash, 130, footerY - 58, 6.5f, bold: false, mono: true, r: 0.4f, g: 0.4f, b: 0.4f);
        }

        // Doctor Signature Block (Right)
        canvas.DrawRightAlignedText($"Electronically Signed by: DR. {doctorName.ToUpperInvariant()}", 555, footerY - 45, 8, bold: true);
        canvas.DrawRightAlignedText($"Registration No: {consultation.DoctorRegistrationNumber ?? "NMC/SMC"}", 555, footerY - 58, 8, bold: false);
        canvas.DrawRightAlignedText("Digitally authorized record", 555, footerY - 70, 7.5f, bold: false, r: 0.5f, g: 0.5f, b: 0.5f);

        return canvas.ToPdfBytes();
    }

    public byte[] GenerateInvoicePdf(Invoice invoice, Clinic? clinic, bool isDuplicate)
    {
        var canvas = new PdfCanvas();

        if (isDuplicate)
        {
            canvas.DrawWatermark("DUPLICATE COPY");
        }

        float y = 800;

        // Clinic Header
        var clinicName = clinic?.LegalName ?? clinic?.Name ?? "HOSPITAL CLINIC & HEALTHCARE";
        canvas.DrawText(clinicName, 40, y, 16, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);
        y -= 15;

        var clinicAddr = $"{clinic?.Address ?? "Clinic Address"} | Phone: {clinic?.Phone ?? "N/A"} | Email: {clinic?.Email ?? "N/A"}";
        canvas.DrawText(clinicAddr, 40, y, 9, bold: false, r: 0.35f, g: 0.35f, b: 0.35f);
        y -= 12;

        if (!string.IsNullOrWhiteSpace(clinic?.PharmacyGstNumber))
        {
            canvas.DrawText($"GSTIN: {clinic.PharmacyGstNumber}", 40, y, 8.5f, bold: true, r: 0.3f, g: 0.3f, b: 0.3f);
            y -= 12;
        }

        canvas.DrawLine(40, y, 555, y, 0.2f, 0.4f, 0.6f, 1.5f);
        y -= 22;

        // Document Title & Invoice Details
        var docTitle = invoice.DocumentType == InvoiceDocumentType.TaxInvoice ? "TAX INVOICE" : "BILL OF SUPPLY";
        canvas.DrawText(docTitle, 40, y, 14, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);

        var invoiceNum = invoice.FormatInvoiceNumber();
        canvas.DrawRightAlignedText($"Invoice #: {invoiceNum}", 555, y, 12, bold: true, r: 0.1f, g: 0.1f, b: 0.1f);
        y -= 14;

        var invDate = invoice.CreatedAt.ToString("dd-MMM-yyyy HH:mm");
        var docSubType = invoice.InvoiceType == InvoiceType.Pharmacy ? "Pharmacy Sales" : "Outpatient Medical Services";
        canvas.DrawText($"Type: {docSubType}", 40, y, 9, bold: false, r: 0.35f, g: 0.35f, b: 0.35f);
        canvas.DrawRightAlignedText($"Date: {invDate}", 555, y, 9, bold: false, r: 0.35f, g: 0.35f, b: 0.35f);
        y -= 18;

        // Linked pharmacy or consultation document reference
        if (invoice.LinkedPharmacyInvoiceId.HasValue)
        {
            canvas.DrawText($"Linked Pharmacy Invoice Ref: {invoice.LinkedPharmacyInvoiceId.Value:N}", 40, y, 8, bold: true, r: 0.2f, g: 0.4f, b: 0.6f);
            y -= 12;
        }

        // Patient Box
        canvas.DrawRect(40, y - 36, 515, 40, 0.96f, 0.97f, 0.99f, fill: true);
        canvas.DrawRect(40, y - 36, 515, 40, 0.85f, 0.88f, 0.92f, fill: false);

        var patientName = invoice.Appointment?.Patient?.Name ?? invoice.WalkInCustomerName ?? "Walk-in Patient";
        var patientPhone = invoice.Appointment?.Patient?.Phone ?? invoice.WalkInCustomerPhone ?? "N/A";
        var uhid = invoice.Appointment?.Patient?.Uhid ?? "N/A";

        canvas.DrawText($"Billed To: {patientName}", 50, y - 14, 9, bold: true);
        canvas.DrawText($"UHID: {uhid}", 250, y - 14, 9, bold: true);
        canvas.DrawRightAlignedText($"Phone: {patientPhone}", 545, y - 14, 9, bold: false);

        var statusBadge = $"Status: {invoice.Status.ToString().ToUpperInvariant()}";
        canvas.DrawText(statusBadge, 50, y - 28, 8.5f, bold: true, r: invoice.Status == InvoiceStatus.Paid ? 0.1f : 0.6f, g: invoice.Status == InvoiceStatus.Paid ? 0.5f : 0.1f, b: 0.1f);
        y -= 48;

        // Line Items Table Header
        canvas.DrawRect(40, y - 14, 515, 18, 0.12f, 0.30f, 0.50f, fill: true);
        canvas.DrawText("#", 45, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawText("ITEM / SERVICE DESCRIPTION", 65, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawText("HSN/SAC", 260, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawRightAlignedText("QTY", 330, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawRightAlignedText("RATE (Rs)", 390, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawRightAlignedText("GST %", 440, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawRightAlignedText("GST (Rs)", 495, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        canvas.DrawRightAlignedText("TOTAL (Rs)", 550, y - 10, 8, bold: true, r: 1f, g: 1f, b: 1f);
        y -= 20;

        // Line Items
        int itemIndex = 1;
        foreach (var line in invoice.LineItems)
        {
            canvas.DrawText(itemIndex.ToString(), 45, y, 8, bold: false);
            canvas.DrawText(line.Description, 65, y, 8, bold: true);
            canvas.DrawText(line.HsnSacCode ?? line.HsnCode ?? "N/A", 260, y, 8, bold: false);
            canvas.DrawRightAlignedText(line.Quantity.ToString(), 330, y, 8, bold: false);
            canvas.DrawRightAlignedText(line.UnitPrice.ToString("F2", CultureInfo.InvariantCulture), 390, y, 8, bold: false);
            canvas.DrawRightAlignedText($"{line.GstRate:F0}%", 440, y, 8, bold: false);
            canvas.DrawRightAlignedText(line.TaxAmount.ToString("F2", CultureInfo.InvariantCulture), 495, y, 8, bold: false);
            var lineTotal = line.Amount + line.TaxAmount;
            canvas.DrawRightAlignedText(lineTotal.ToString("F2", CultureInfo.InvariantCulture), 550, y, 8, bold: true);

            canvas.DrawLine(40, y - 4, 555, y - 4, 0.9f, 0.9f, 0.9f, 0.5f);
            y -= 16;
            itemIndex++;
        }

        y -= 10;

        // Totals Box (Right Aligned)
        float totalBoxLeft = 320;
        canvas.DrawRect(totalBoxLeft, y - 85, 235, 90, 0.97f, 0.98f, 0.99f, fill: true);
        canvas.DrawRect(totalBoxLeft, y - 85, 235, 90, 0.85f, 0.88f, 0.92f, fill: false);

        canvas.DrawText("Subtotal (Taxable):", totalBoxLeft + 10, y - 14, 8.5f, bold: false);
        canvas.DrawRightAlignedText($"Rs. {invoice.Subtotal:F2}", 545, y - 14, 8.5f, bold: false);

        canvas.DrawText("GST Total:", totalBoxLeft + 10, y - 28, 8.5f, bold: false);
        canvas.DrawRightAlignedText($"Rs. {invoice.GstAmount:F2}", 545, y - 28, 8.5f, bold: false);

        if (invoice.DiscountAmount > 0)
        {
            canvas.DrawText("Discount Allowed:", totalBoxLeft + 10, y - 42, 8.5f, bold: false, r: 0.6f, g: 0.1f, b: 0.1f);
            canvas.DrawRightAlignedText($"- Rs. {invoice.DiscountAmount:F2}", 545, y - 42, 8.5f, bold: false, r: 0.6f, g: 0.1f, b: 0.1f);
        }

        canvas.DrawLine(totalBoxLeft + 5, y - 48, 550, y - 48, 0.7f, 0.7f, 0.7f, 1f);

        canvas.DrawText("Grand Total:", totalBoxLeft + 10, y - 62, 10, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);
        canvas.DrawRightAlignedText($"Rs. {invoice.Total:F2}", 545, y - 62, 10, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);

        canvas.DrawText("Paid Amount / Balance Due:", totalBoxLeft + 10, y - 76, 8, bold: false);
        canvas.DrawRightAlignedText($"Paid: Rs. {invoice.PaidAmount:F2} | Due: Rs. {invoice.BalanceDue:F2}", 545, y - 76, 8, bold: true);

        // Payments Summary (Left)
        if (invoice.Payments.Any())
        {
            canvas.DrawText("PAYMENT TRANSACTIONS:", 40, y - 14, 8.5f, bold: true, r: 0.2f, g: 0.2f, b: 0.2f);
            float payY = y - 28;
            foreach (var p in invoice.Payments.Take(3))
            {
                var payLine = $"- {p.Method} Rs. {p.Amount:F2} ({p.Status}) | UTR/Ref: {p.Utr ?? p.RazorpayPaymentId ?? "Cash"}";
                canvas.DrawText(payLine, 45, payY, 7.5f, bold: false);
                payY -= 12;
            }
        }

        // Footer
        canvas.DrawLine(40, 55, 555, 55, 0.8f, 0.8f, 0.8f, 1f);
        canvas.DrawText("This is a computer-generated tax document. Thank you for choosing our healthcare services.", 40, 42, 8, bold: false, r: 0.4f, g: 0.4f, b: 0.4f);

        return canvas.ToPdfBytes();
    }

    public byte[] GenerateCreditNotePdf(CreditNote creditNote, Invoice invoice, Clinic? clinic)
    {
        var canvas = new PdfCanvas();

        float y = 800;

        // Clinic Header
        var clinicName = clinic?.LegalName ?? clinic?.Name ?? "HOSPITAL CLINIC & HEALTHCARE";
        canvas.DrawText(clinicName, 40, y, 16, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);
        y -= 15;

        var clinicAddr = $"{clinic?.Address ?? "Clinic Address"} | Phone: {clinic?.Phone ?? "N/A"}";
        canvas.DrawText(clinicAddr, 40, y, 9, bold: false, r: 0.35f, g: 0.35f, b: 0.35f);
        y -= 12;

        if (!string.IsNullOrWhiteSpace(clinic?.PharmacyGstNumber))
        {
            canvas.DrawText($"GSTIN: {clinic.PharmacyGstNumber}", 40, y, 8.5f, bold: true, r: 0.3f, g: 0.3f, b: 0.3f);
            y -= 12;
        }

        canvas.DrawLine(40, y, 555, y, 0.7f, 0.2f, 0.2f, 1.5f);
        y -= 22;

        // Document Title
        canvas.DrawText("CREDIT NOTE", 40, y, 14, bold: true, r: 0.7f, g: 0.15f, b: 0.15f);
        canvas.DrawRightAlignedText($"Credit Note #: {creditNote.CreditNoteNumber}", 555, y, 12, bold: true);
        y -= 14;

        var cnDate = creditNote.IssuedAt.ToString("dd-MMM-yyyy HH:mm");
        canvas.DrawText($"Original Invoice Ref: {invoice.FormatInvoiceNumber()}", 40, y, 9, bold: true, r: 0.2f, g: 0.2f, b: 0.2f);
        canvas.DrawRightAlignedText($"Issue Date: {cnDate}", 555, y, 9, bold: false, r: 0.35f, g: 0.35f, b: 0.35f);
        y -= 20;

        // Patient Box
        canvas.DrawRect(40, y - 36, 515, 40, 0.98f, 0.96f, 0.96f, fill: true);
        canvas.DrawRect(40, y - 36, 515, 40, 0.90f, 0.82f, 0.82f, fill: false);

        var patientName = invoice.Appointment?.Patient?.Name ?? invoice.WalkInCustomerName ?? "Walk-in Patient";
        var patientPhone = invoice.Appointment?.Patient?.Phone ?? invoice.WalkInCustomerPhone ?? "N/A";
        var uhid = invoice.Appointment?.Patient?.Uhid ?? "N/A";

        canvas.DrawText($"Credit Issued To: {patientName}", 50, y - 14, 9, bold: true);
        canvas.DrawText($"UHID: {uhid}", 260, y - 14, 9, bold: true);
        canvas.DrawRightAlignedText($"Phone: {patientPhone}", 545, y - 14, 9, bold: false);

        canvas.DrawText($"Status: {creditNote.Status.ToString().ToUpperInvariant()}", 50, y - 28, 8.5f, bold: true, r: 0.1f, g: 0.5f, b: 0.1f);
        y -= 50;

        // Credit Details Box
        canvas.DrawRect(40, y - 100, 515, 105, 0.99f, 0.99f, 0.99f, fill: true);
        canvas.DrawRect(40, y - 100, 515, 105, 0.85f, 0.85f, 0.85f, fill: false);

        canvas.DrawText("CREDIT ADJUSTMENT DETAILS", 50, y - 16, 10, bold: true, r: 0.7f, g: 0.15f, b: 0.15f);

        canvas.DrawText("Reason for Credit Note:", 50, y - 34, 9, bold: true);
        canvas.DrawText(creditNote.Reason, 170, y - 34, 9, bold: false);

        canvas.DrawText("Credit Note Amount:", 50, y - 52, 10, bold: true);
        canvas.DrawText($"Rs. {creditNote.Amount:F2}", 170, y - 52, 11, bold: true, r: 0.7f, g: 0.15f, b: 0.15f);

        canvas.DrawText("Original Invoice Total:", 50, y - 70, 9, bold: false);
        canvas.DrawText($"Rs. {invoice.Total:F2}", 170, y - 70, 9, bold: false);

        canvas.DrawText("Revised Balance Due:", 50, y - 86, 9, bold: true);
        canvas.DrawText($"Rs. {invoice.BalanceDue:F2}", 170, y - 86, 9, bold: true, r: 0.08f, g: 0.25f, b: 0.45f);

        y -= 130;

        // Approval info
        canvas.DrawText("APPROVAL & AUDIT RECORD", 40, y, 9, bold: true, r: 0.2f, g: 0.2f, b: 0.2f);
        y -= 16;
        canvas.DrawText($"- Approved By User ID: {creditNote.ApprovedByUserId}", 45, y, 8, bold: false);
        y -= 12;
        if (creditNote.SecondApprovedByUserId.HasValue)
        {
            canvas.DrawText($"- Dual-Control Second Approver ID: {creditNote.SecondApprovedByUserId.Value}", 45, y, 8, bold: false);
            y -= 12;
        }

        // Footer
        canvas.DrawLine(40, 55, 555, 55, 0.8f, 0.8f, 0.8f, 1f);
        canvas.DrawText("This credit note constitutes a formal accounts receivable adjustment under statutory compliance.", 40, 42, 8, bold: false, r: 0.4f, g: 0.4f, b: 0.4f);

        return canvas.ToPdfBytes();
    }
}

/// <summary>
/// Lightweight, high-performance, pure C# standard PDF 1.4 canvas builder.
/// Zero native dependencies, standard Type 1 fonts, embedded vector QR code.
/// </summary>
public class PdfCanvas
{
    private readonly StringBuilder _stream = new();

    public void DrawWatermark(string text)
    {
        _stream.AppendLine("q");
        _stream.AppendLine("0.90 0.90 0.90 rg");
        _stream.AppendLine("/F2 42 Tf");
        // Center diagonally
        _stream.AppendLine("1 0 0 1 120 400 cm");
        _stream.AppendLine("0.7071 0.7071 -0.7071 0.7071 0 0 cm");
        _stream.AppendLine(CultureInfo.InvariantCulture, $"BT 0 0 Td ({EscapePdf(text)}) Tj ET");
        _stream.AppendLine("Q");
    }

    public void DrawText(string text, float x, float y, float size = 10, bool bold = false, bool mono = false, float r = 0, float g = 0, float b = 0)
    {
        if (string.IsNullOrEmpty(text)) return;
        var font = mono ? "/F3" : (bold ? "/F2" : "/F1");
        _stream.AppendLine(CultureInfo.InvariantCulture, $"{r:F2} {g:F2} {b:F2} rg");
        _stream.AppendLine(CultureInfo.InvariantCulture, $"BT {font} {size:F2} Tf {x:F2} {y:F2} Td ({EscapePdf(text)}) Tj ET");
    }

    public void DrawRightAlignedText(string text, float rightX, float y, float size = 10, bool bold = false, float r = 0, float g = 0, float b = 0)
    {
        if (string.IsNullOrEmpty(text)) return;
        // Approximate width for Helvetica characters (~0.52 of font size per character)
        float approxWidth = text.Length * size * 0.52f;
        float x = Math.Max(40f, rightX - approxWidth);
        DrawText(text, x, y, size, bold, mono: false, r, g, b);
    }

    public void DrawRect(float x, float y, float width, float height, float r, float g, float b, bool fill = true)
    {
        if (fill)
        {
            _stream.AppendLine(CultureInfo.InvariantCulture, $"{r:F2} {g:F2} {b:F2} rg");
            _stream.AppendLine(CultureInfo.InvariantCulture, $"{x:F2} {y:F2} {width:F2} {height:F2} re f");
        }
        else
        {
            _stream.AppendLine(CultureInfo.InvariantCulture, $"{r:F2} {g:F2} {b:F2} RG");
            _stream.AppendLine(CultureInfo.InvariantCulture, $"{x:F2} {y:F2} {width:F2} {height:F2} re s");
        }
    }

    public void DrawLine(float x1, float y1, float x2, float y2, float r, float g, float b, float width = 1)
    {
        _stream.AppendLine(CultureInfo.InvariantCulture, $"{width:F2} w");
        _stream.AppendLine(CultureInfo.InvariantCulture, $"{r:F2} {g:F2} {b:F2} RG");
        _stream.AppendLine(CultureInfo.InvariantCulture, $"{x1:F2} {y1:F2} m {x2:F2} {y2:F2} l S");
    }

    public void DrawQrCode(string text, float xPos, float yPos, float size)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrData = qrGenerator.CreateQrCode(text, QRCodeGenerator.ECCLevel.M);

        var matrix = qrData.ModuleMatrix;
        int modulesCount = matrix.Count;
        float moduleSize = size / modulesCount;

        // White background border
        DrawRect(xPos - 3, yPos - 3, size + 6, size + 6, 1f, 1f, 1f, fill: true);
        DrawRect(xPos - 3, yPos - 3, size + 6, size + 6, 0.85f, 0.85f, 0.85f, fill: false);

        // Black modules
        _stream.AppendLine("0 0 0 rg");
        for (int row = 0; row < modulesCount; row++)
        {
            for (int col = 0; col < modulesCount; col++)
            {
                if (matrix[row].Get(col))
                {
                    float mx = xPos + (col * moduleSize);
                    float my = yPos + ((modulesCount - 1 - row) * moduleSize);
                    _stream.AppendLine(CultureInfo.InvariantCulture, $"{mx:F2} {my:F2} {moduleSize:F2} {moduleSize:F2} re f");
                }
            }
        }
    }

    public byte[] ToPdfBytes()
    {
        var content = _stream.ToString();
        var contentBytes = Encoding.UTF8.GetBytes(content);

        using var ms = new MemoryStream();
        using var writer = new StreamWriter(ms, Encoding.ASCII);

        var offsets = new List<long>();

        // Header
        writer.Write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
        writer.Flush();

        // Object 1: Catalog
        offsets.Add(ms.Position);
        writer.Write("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
        writer.Flush();

        // Object 2: Pages
        offsets.Add(ms.Position);
        writer.Write("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
        writer.Flush();

        // Object 3: Page (A4: 595.28 x 841.89)
        offsets.Add(ms.Position);
        writer.Write("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>\nendobj\n");
        writer.Flush();

        // Object 4: Content Stream
        offsets.Add(ms.Position);
        writer.Write($"4 0 obj\n<< /Length {contentBytes.Length} >>\nstream\n");
        writer.Flush();
        ms.Write(contentBytes, 0, contentBytes.Length);
        writer.Write("\nendstream\nendobj\n");
        writer.Flush();

        // Object 5: Helvetica (regular)
        offsets.Add(ms.Position);
        writer.Write("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");
        writer.Flush();

        // Object 6: Helvetica-Bold
        offsets.Add(ms.Position);
        writer.Write("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");
        writer.Flush();

        // Object 7: Courier (monospace)
        offsets.Add(ms.Position);
        writer.Write("7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n");
        writer.Flush();

        // Xref table
        long xrefOffset = ms.Position;
        writer.Write($"xref\n0 {offsets.Count + 1}\n");
        writer.Write("0000000000 65535 f \n");
        foreach (var offset in offsets)
        {
            writer.Write($"{offset:D10} 00000 n \n");
        }

        // Trailer
        writer.Write($"trailer\n<< /Size {offsets.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefOffset}\n%%EOF\n");
        writer.Flush();

        return ms.ToArray();
    }

    private static string EscapePdf(string? input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;
        var sanitized = input.Replace("₹", "Rs. ");
        var sb = new StringBuilder(sanitized.Length + 10);
        foreach (var ch in sanitized)
        {
            if (ch is '(' or ')' or '\\')
            {
                sb.Append('\\').Append(ch);
            }
            else if (ch < 32 || ch > 126)
            {
                if (ch is '\n' or '\r') sb.Append(' ');
                else if (ch > 126 && ch <= 255) sb.Append(ch);
                else sb.Append(' ');
            }
            else
            {
                sb.Append(ch);
            }
        }
        return sb.ToString();
    }
}
