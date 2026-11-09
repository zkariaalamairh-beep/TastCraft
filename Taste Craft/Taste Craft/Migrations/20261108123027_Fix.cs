using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Taste_Craft.Migrations
{
    /// <inheritdoc />
    public partial class Fix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Add new columns (nullable first).
            migrationBuilder.AddColumn<DateOnly>(
                name: "OrderDate",
                table: "Orders",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DailyNumber",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Discount",
                table: "Orders",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            // 2) Backfill old orders from their UTC creation day.
            migrationBuilder.Sql(@"
UPDATE Orders
SET OrderDate = CAST(CreatedAtUtc AS date);

;WITH numbered AS (
    SELECT Id,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(CreatedAtUtc AS date)
            ORDER BY CreatedAtUtc, Id) AS rn
    FROM Orders
)
UPDATE o
SET o.DailyNumber = n.rn
FROM Orders o
JOIN numbered n ON n.Id = o.Id;
");

            // 3) Make them required now that data exists.
            migrationBuilder.AlterColumn<DateOnly>(
                name: "OrderDate",
                table: "Orders",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "DailyNumber",
                table: "Orders",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            // 4) Now the unique index is safe.
            migrationBuilder.CreateIndex(
                name: "IX_Orders_OrderDate_DailyNumber",
                table: "Orders",
                columns: new[] { "OrderDate", "DailyNumber" },
                unique: true);

            // 5) Role changes (old seeded roles removed).
            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "role-employee");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "role-admin");

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { "role-kitchen", "seed-kitchen-v1", "Kitchen", "KITCHEN" },
                    { "role-manager", "seed-manager-v1", "Manager", "MANAGER" },
                    { "role-owner", "seed-owner-v1", "Owner", "OWNER" }
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_OrderDate_DailyNumber",
                table: "Orders");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "role-kitchen");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "role-manager");

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: "role-owner");

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { "role-employee", "seed-employee-v1", "Employee", "EMPLOYEE" },
                    { "role-admin", "seed-admin-v1", "Admin", "ADMIN" }
                });

            migrationBuilder.DropColumn(
                name: "Discount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DailyNumber",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OrderDate",
                table: "Orders");
        }
    }
}
