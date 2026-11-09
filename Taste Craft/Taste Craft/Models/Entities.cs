using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;


namespace TasteCraft.Models;

public static class AppRoles
{
    public const string Customer = "Customer";
    public const string Kitchen = "Kitchen";
    public const string Manager = "Manager";
    public const string Owner = "Owner";

    // Composite role lists for [Authorize] attributes.
    public const string Staff = "Kitchen,Manager,Owner";
    public const string Management = "Manager,Owner";
    public const string Ordering = "Customer,Manager,Owner";
}

public enum OrderStatus
{
    Pending,
    Preparing,
    Ready,
    Completed,
    Cancelled
}

public class AppUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;

    public ICollection<Order> Orders { get; set; } = new List<Order>();
}

public class Category
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    // صورة التصنيف اختيارية
    public string? ImageUrl { get; set; }

    public int DisplayOrder { get; set; }

    public ICollection<MenuItem> MenuItems { get; set; }
        = new List<MenuItem>();
}
public class MenuItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }

    public bool IsAvailable { get; set; } = true;
    public bool IsFeatured { get; set; }

    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}

public class Order
{
    public int Id { get; set; }

    public string CustomerId { get; set; } = string.Empty;
    public AppUser Customer { get; set; } = null!;

    // Customer details captured when placing the order.
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;

    public OrderType Type { get; set; } = OrderType.Pickup;

    // Required for delivery orders only.
    public string? DeliveryAddress { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;

    public OrderStatus Status { get; set; }
        = OrderStatus.Pending;

    public string? Notes { get; set; }

    // Prices captured when placing the order.
    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal TotalAmount { get; set; }

    // Daily sequential number, resets every day.
    public DateOnly OrderDate { get; set; }

    public int DailyNumber { get; set; }

    // Staff discount applied at pricing time.
    public decimal Discount { get; set; }

    public byte[] RowVersion { get; set; }
        = Array.Empty<byte>();

    public ICollection<OrderItem> Items { get; set; }
        = new List<OrderItem>();
}


public class OrderItem
{
    public int Id { get; set; }

    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public int MenuItemId { get; set; }
    public MenuItem MenuItem { get; set; } = null!;

    // Snapshots: changing the menu later must not change old orders.
    public string MenuItemName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }

    // Customer customization saved with the line (sauces, removals, ...).
    [MaxLength(200)]
    public string? Note { get; set; }
}