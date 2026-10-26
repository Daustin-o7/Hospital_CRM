using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingClinicalColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Qualifications",
                table: "TenantMemberships",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RegistrationNumber",
                table: "TenantMemberships",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BrandName",
                table: "PrescriptionItems",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DosageForm",
                table: "PrescriptionItems",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "DrugId",
                table: "PrescriptionItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Duration",
                table: "PrescriptionItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DurationUnit",
                table: "PrescriptionItems",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Frequency",
                table: "PrescriptionItems",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "GenericName",
                table: "PrescriptionItems",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsDispensed",
                table: "PrescriptionItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsUnverified",
                table: "PrescriptionItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Route",
                table: "PrescriptionItems",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ScheduleClass",
                table: "PrescriptionItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SpecialInstructions",
                table: "PrescriptionItems",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Strength",
                table: "PrescriptionItems",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Timing",
                table: "PrescriptionItems",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "TotalQuantity",
                table: "PrescriptionItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsAbnormal",
                table: "LabResults",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceRange",
                table: "LabResults",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Units",
                table: "LabResults",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DoctorReviewNotes",
                table: "LabOrders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DoctorReviewedAt",
                table: "LabOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DoctorReviewedByUserId",
                table: "LabOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAbnormal",
                table: "LabOrders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "AdvisedInvestigations",
                table: "Consultations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AmendmentReason",
                table: "Consultations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DigitalSignatureHash",
                table: "Consultations",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DoctorQualifications",
                table: "Consultations",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DoctorRegistrationNumber",
                table: "Consultations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "FollowUpDate",
                table: "Consultations",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FollowUpNotes",
                table: "Consultations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IcdCode",
                table: "Consultations",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IcdTitle",
                table: "Consultations",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SignedAt",
                table: "Consultations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SignedByDoctorId",
                table: "Consultations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Consultations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "StructuredObservationsJson",
                table: "Consultations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TemplateId",
                table: "Consultations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TemplateVersion",
                table: "Consultations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "Consultations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VerificationQrCode",
                table: "Consultations",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrescriptionItems_DrugId",
                table: "PrescriptionItems",
                column: "DrugId");

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_Status",
                table: "Consultations",
                column: "Status");

            migrationBuilder.AddForeignKey(
                name: "FK_PrescriptionItems_Drugs_DrugId",
                table: "PrescriptionItems",
                column: "DrugId",
                principalTable: "Drugs",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PrescriptionItems_Drugs_DrugId",
                table: "PrescriptionItems");

            migrationBuilder.DropIndex(
                name: "IX_PrescriptionItems_DrugId",
                table: "PrescriptionItems");

            migrationBuilder.DropIndex(
                name: "IX_Consultations_Status",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "Qualifications",
                table: "TenantMemberships");

            migrationBuilder.DropColumn(
                name: "RegistrationNumber",
                table: "TenantMemberships");

            migrationBuilder.DropColumn(
                name: "BrandName",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "DosageForm",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "DrugId",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "Duration",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "DurationUnit",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "Frequency",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "GenericName",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "IsDispensed",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "IsUnverified",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "Route",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "ScheduleClass",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "SpecialInstructions",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "Strength",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "Timing",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "TotalQuantity",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "IsAbnormal",
                table: "LabResults");

            migrationBuilder.DropColumn(
                name: "ReferenceRange",
                table: "LabResults");

            migrationBuilder.DropColumn(
                name: "Units",
                table: "LabResults");

            migrationBuilder.DropColumn(
                name: "DoctorReviewNotes",
                table: "LabOrders");

            migrationBuilder.DropColumn(
                name: "DoctorReviewedAt",
                table: "LabOrders");

            migrationBuilder.DropColumn(
                name: "DoctorReviewedByUserId",
                table: "LabOrders");

            migrationBuilder.DropColumn(
                name: "IsAbnormal",
                table: "LabOrders");

            migrationBuilder.DropColumn(
                name: "AdvisedInvestigations",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "AmendmentReason",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "DigitalSignatureHash",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "DoctorQualifications",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "DoctorRegistrationNumber",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "FollowUpDate",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "FollowUpNotes",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "IcdCode",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "IcdTitle",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "SignedAt",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "SignedByDoctorId",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "StructuredObservationsJson",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "TemplateId",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "TemplateVersion",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "VerificationQrCode",
                table: "Consultations");
        }
    }
}
