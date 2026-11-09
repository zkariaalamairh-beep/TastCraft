using System.ComponentModel.DataAnnotations;
using TasteCraft.Models;

namespace TasteCraft.Contracts;

// إنشاء حساب عميل أو موظف
public record RegisterRequest(
    [Required, StringLength(100, MinimumLength = 2)]
    string FullName,

    [Required, EmailAddress, StringLength(256)]
    string Email,

    [Required, StringLength(128, MinimumLength = 10)]
    string Password
);

// تسجيل الدخول
public record LoginRequest(
    [Required, EmailAddress, StringLength(256)]
    string Email,

    [Required, StringLength(128)]
    string Password
);

// تغيير كلمة المرور
public record ChangePasswordRequest(
    [Required, StringLength(128)]
    string CurrentPassword,

    [Required, StringLength(128, MinimumLength = 10)]
    string NewPassword
);

// Manager creates Kitchen. Owner creates Kitchen or Manager.
public record CreateStaffRequest(
    [Required, StringLength(100, MinimumLength = 2)]
    string FullName,

    [Required, EmailAddress, StringLength(256)]
    string Email,

    [Required, StringLength(128, MinimumLength = 10)]
    string Password,

    [Required]
    string Role
);

// إنشاء تصنيف
public record CreateCategoryRequest(
    [Required, StringLength(80)]
    string Name,

    [StringLength(2048)]
    string? ImageUrl,

    [Range(0, 10000)]
    int DisplayOrder = 0
);

// إنشاء وجبة
public record CreateMenuItemRequest(
    [Required, StringLength(120)]
    string Name,

    [Required(AllowEmptyStrings = true), StringLength(1500)]
    string Description,

    [Range(typeof(decimal), "0.01", "999999.99")]
    decimal Price,

    [StringLength(2048)]
    string? ImageUrl,

    bool IsFeatured,

    [Range(1, int.MaxValue)]
    int CategoryId
);

// إنشاء طلب
public record CreateOrderRequest(
    [Required, EnumDataType(typeof(OrderType))]
    OrderType? Type,

    [Required, Phone, StringLength(30)]
    string PhoneNumber,

    [Required, MinLength(1), MaxLength(50)]
    List<OrderItemDto> Items,

    [StringLength(500)]
    string? DeliveryAddress = null,

    [StringLength(500)]
    string? Notes = null
);

// وجبة داخل الطلب
public record OrderItemDto(
    [Range(1, int.MaxValue)]
    int MenuItemId,

    [Range(1, 99)]
    int Quantity,

    [StringLength(200)]
    string? Note = null
);

// تغيير حالة الطلب
public record UpdateOrderStatusRequest(
    [Required, EnumDataType(typeof(OrderStatus))]
    string Status
);

// Updating a menu item
public record UpdateMenuItemRequest(
    [Required, StringLength(120)]
    string Name,

    [Required(AllowEmptyStrings = true), StringLength(1500)]
    string Description,

    [Range(typeof(decimal), "0.01", "999999.99")]
    decimal Price,

    [StringLength(2048)]
    string? ImageUrl,

    bool IsFeatured,

    [Range(1, int.MaxValue)]
    int CategoryId
);

// Changing availability
public record UpdateMenuItemAvailabilityRequest(
    [Required]
    bool? IsAvailable
);

// Menu item response without navigation properties
public record MenuItemResponse(
    int Id,
    string Name,
    string Description,
    decimal Price,
    string? ImageUrl,
    bool IsAvailable,
    bool IsFeatured,
    int CategoryId,
    string CategoryName
);

public record CategoryResponse(
    int Id,
    string Name,
    string? ImageUrl,
    int DisplayOrder
);

public record DashboardSummaryResponse(
    int TodayOrders,

    int TotalOrders,
    int PendingOrders,
    int PreparingOrders,
    int ReadyOrders,
    int CompletedOrders,
    int CancelledOrders,
    decimal CompletedOrdersTotal,
    int TotalMenuItems,
    int AvailableMenuItems,
    int UnavailableMenuItems,
    int TotalCategories,
    int TotalReviews,
    decimal? AverageRating
);

public record CreateOrderReviewRequest(
    [Range(1, 5)]
    int Rating,

    [StringLength(1000)]
    string? Comment = null
);

public record OrderReviewResponse(
    int Id,
    int OrderId,
    int Rating,
    string? Comment,
    DateTimeOffset CreatedAtUtc
);

public record AuthUserResponse(
    string Id,
    string FullName,
    string? Email,
    IReadOnlyList<string> Roles
);

public record AuthResponse(
    string AccessToken,
    DateTimeOffset ExpiresAtUtc,
    AuthUserResponse User
);

public record OrderQuoteRequest(
    [Required, EnumDataType(typeof(OrderType))]
    OrderType? Type,

    [Required, MinLength(1), MaxLength(50)]
    List<OrderItemDto> Items
);

// Owner: change a staff member's role.
public record UpdateStaffRoleRequest(
    [Required]
    string Role
);