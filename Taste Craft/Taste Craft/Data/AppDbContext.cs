using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TasteCraft.Models;

namespace TasteCraft.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser>(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<OrderReview> OrderReviews => Set<OrderReview>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Order reviews
        builder.Entity<OrderReview>(entity =>
        {
            entity.ToTable("OrderReviews", table =>
            {
                table.HasCheckConstraint(
                    "CK_OrderReviews_Rating",
                    "[Rating] BETWEEN 1 AND 5");
            });

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Comment)
                .HasMaxLength(1000);

            // One review per order, enforced by the database.
            entity.HasIndex(x => x.OrderId)
                .IsUnique();

            entity.HasOne(x => x.Order)
                .WithOne()
                .HasForeignKey<OrderReview>(x => x.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("RefreshTokens");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.UserId)
                .HasMaxLength(450)
                .IsRequired();

            entity.Property(x => x.TokenHash)
                .HasMaxLength(64)
                .IsUnicode(false)
                .IsRequired();

            entity.Property(x => x.UserSecurityStamp)
                .HasMaxLength(256)
                .IsRequired();

            entity.Property(x => x.ReplacedByTokenHash)
                .HasMaxLength(64)
                .IsUnicode(false);

            entity.Property(x => x.RowVersion)
                .IsRowVersion();

            entity.HasIndex(x => x.TokenHash)
                .IsUnique();

            entity.HasIndex(x => x.SessionId);

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        base.OnModelCreating(builder);

        builder.Entity<AppUser>()
            .Property(x => x.FullName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Entity<Category>()
            .Property(x => x.Name)
            .HasMaxLength(80)
            .IsRequired();

        builder.Entity<Category>()
            .HasIndex(x => x.Name)
            .IsUnique();

        builder.Entity<MenuItem>()
            .Property(x => x.Name)
            .HasMaxLength(120)
            .IsRequired();

        builder.Entity<MenuItem>()
            .Property(x => x.Description)
            .HasMaxLength(1500);

        builder.Entity<MenuItem>()
            .Property(x => x.ImageUrl)
            .HasMaxLength(2048);

        builder.Entity<MenuItem>()
            .Property(x => x.Price)
            .HasPrecision(18, 2);

        builder.Entity<MenuItem>()
            .HasOne(x => x.Category)
            .WithMany(x => x.MenuItems)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<Order>()
            .Property(x => x.CustomerName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Entity<Order>()
            .Property(x => x.CustomerPhone)
            .HasMaxLength(30)
            .IsRequired();

        builder.Entity<Order>()
            .Property(x => x.Notes)
            .HasMaxLength(500);

        builder.Entity<Order>()
            .Property(x => x.TotalAmount)
            .HasPrecision(18, 2);

        builder.Entity<Order>()
            .Property(x => x.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Entity<Order>()
            .Property(x => x.RowVersion)
            .IsRowVersion();

        builder.Entity<Order>()
            .HasIndex(x => new { x.CustomerId, x.CreatedAtUtc });

        // NEW: unique daily sequence per calendar day.
        builder.Entity<Order>()
            .HasIndex(x => new { x.OrderDate, x.DailyNumber })
            .IsUnique();

        builder.Entity<Order>()
            .HasOne(x => x.Customer)
            .WithMany(x => x.Orders)
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Entity<OrderItem>()
            .Property(x => x.MenuItemName)
            .HasMaxLength(120)
            .IsRequired();

        builder.Entity<OrderItem>()
            .Property(x => x.UnitPrice)
            .HasPrecision(18, 2);

        builder.Entity<OrderItem>()
            .HasIndex(x => new { x.OrderId, x.MenuItemId })
            .IsUnique();

        builder.Entity<OrderItem>()
            .HasOne(x => x.Order)
            .WithMany(x => x.Items)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<OrderItem>()
            .HasOne(x => x.MenuItem)
            .WithMany(x => x.OrderItems)
            .HasForeignKey(x => x.MenuItemId)
            .OnDelete(DeleteBehavior.Restrict);

        // Delivery and pickup options
        builder.Entity<Order>()
            .Property(x => x.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(OrderType.Pickup);

        builder.Entity<Order>()
            .Property(x => x.DeliveryAddress)
            .HasMaxLength(500);

        builder.Entity<Order>()
            .Property(x => x.Subtotal)
            .HasPrecision(18, 2);

        builder.Entity<Order>()
            .Property(x => x.DeliveryFee)
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        // NEW: staff discount column.
        builder.Entity<Order>()
            .Property(x => x.Discount)
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        // Stable values prevent unnecessary changes in later migrations.
        builder.Entity<IdentityRole>().HasData(
            new IdentityRole
            {
                Id = "role-customer",
                Name = AppRoles.Customer,
                NormalizedName = "CUSTOMER",
                ConcurrencyStamp = "seed-customer-v1"
            },
            new IdentityRole
            {
                Id = "role-kitchen",
                Name = AppRoles.Kitchen,
                NormalizedName = "KITCHEN",
                ConcurrencyStamp = "seed-kitchen-v1"
            },
            new IdentityRole
            {
                Id = "role-manager",
                Name = AppRoles.Manager,
                NormalizedName = "MANAGER",
                ConcurrencyStamp = "seed-manager-v1"
            },
            new IdentityRole
            {
                Id = "role-owner",
                Name = AppRoles.Owner,
                NormalizedName = "OWNER",
                ConcurrencyStamp = "seed-owner-v1"
            });
    }
}