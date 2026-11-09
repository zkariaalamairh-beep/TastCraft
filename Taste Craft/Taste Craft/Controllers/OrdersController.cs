using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TasteCraft.Contracts;
using TasteCraft.Data;
using TasteCraft.Models;

namespace TasteCraft.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController(
    AppDbContext db,
    IConfiguration configuration) : ControllerBase
{
    private const decimal FreeDeliveryThreshold = 50m;
    private const decimal StandardDeliveryFee = 3m;

    // Staff discount for Manager and Owner orders.
    private const decimal StaffDiscountRate = 0.20m;

    private string? UserId =>
        User.FindFirst("sub")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    private bool IsEligibleForStaffDiscount =>
        User.IsInRole(AppRoles.Manager)
        || User.IsInRole(AppRoles.Owner);

    // The restaurant's local calendar day for daily numbering.
    private DateOnly RestaurantToday()
    {
        var timeZoneId = configuration["Orders:TimeZone"];

        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return DateOnly.FromDateTime(DateTime.Now);
        }

        var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);

        return DateOnly.FromDateTime(
            TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, zone).DateTime);
    }

    // Public: calculate current prices without creating an order.
    // Signed-in Manager/Owner accounts see their discount here too.
    [AllowAnonymous]
    [HttpPost("quote")]
    public async Task<IActionResult> Quote(OrderQuoteRequest req)
    {
        var (pricing, error) = await CalculateAsync(
            req.Type,
            req.Items,
            IsEligibleForStaffDiscount);

        if (pricing is null)
            return BadRequest(new { message = error });

        var effectiveSubtotal =
            pricing.Subtotal - pricing.Discount;

        return Ok(new
        {
            pricing.Type,
            pricing.Subtotal,
            pricing.Discount,
            pricing.DeliveryFee,
            pricing.TotalAmount,

            freeDeliveryThreshold = FreeDeliveryThreshold,

            amountUntilFreeDelivery =
                pricing.Type == OrderType.Delivery
                    ? Math.Max(
                        0m,
                        FreeDeliveryThreshold - effectiveSubtotal)
                    : 0m,

            items = ToItemsResponse(pricing.Items)
        });
    }

    // Customer, Manager and Owner: place an order.
    [Authorize(Roles = AppRoles.Ordering)]
    [HttpPost]
    public async Task<IActionResult> Create(
        CreateOrderRequest req,
        CancellationToken cancellationToken)
    {
        var customerId = UserId;

        if (string.IsNullOrWhiteSpace(customerId))
            return Unauthorized();

        if (req.Type == OrderType.Delivery &&
            string.IsNullOrWhiteSpace(req.DeliveryAddress))
        {
            return BadRequest(new
            {
                message = "A delivery address is required."
            });
        }

        var customer = await db.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == customerId,
                cancellationToken);

        if (customer is null)
            return Unauthorized();

        // Recalculate from the database. Never trust the browser.
        var (pricing, error) = await CalculateAsync(
            req.Type,
            req.Items,
            IsEligibleForStaffDiscount);

        if (pricing is null)
            return BadRequest(new { message = error });

        var order = new Order
        {
            CustomerId = customerId,
            CustomerName = customer.FullName,
            CustomerPhone = req.PhoneNumber.Trim(),

            Type = pricing.Type,

            DeliveryAddress =
                pricing.Type == OrderType.Delivery
                    ? req.DeliveryAddress!.Trim()
                    : null,

            Notes = req.Notes?.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            Status = OrderStatus.Pending,

            Subtotal = pricing.Subtotal,
            Discount = pricing.Discount,
            DeliveryFee = pricing.DeliveryFee,
            TotalAmount = pricing.TotalAmount,

            Items = pricing.Items
        };

        // Daily numbers must be assigned atomically.
        await using var transaction =
            await db.Database.BeginTransactionAsync(cancellationToken);

        var orderDate = RestaurantToday();

        var maxDailyNumber = await db.Orders
            .AsNoTracking()
            .Where(x => x.OrderDate == orderDate)
            .MaxAsync(x => (int?)x.DailyNumber, cancellationToken)
            ?? 0;

        order.OrderDate = orderDate;
        order.DailyNumber = maxDailyNumber + 1;

        db.Orders.Add(order);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Two orders raced for the same daily number.
            return Conflict(new
            {
                message =
                    "The kitchen is busy right now. " +
                    "Please place your order again."
            });
        }

        await transaction.CommitAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { id = order.Id },
            ToResponse(order));
    }

    // Customer, Manager and Owner: list owned orders.
    [Authorize(Roles = AppRoles.Ordering)]
    [HttpGet("my")]
    public async Task<IActionResult> GetMyOrders(
        CancellationToken cancellationToken)
    {
        var customerId = UserId;

        if (string.IsNullOrWhiteSpace(customerId))
            return Unauthorized();

        var orders = await db.Orders
            .AsNoTracking()
            .Where(x => x.CustomerId == customerId)
            .Include(x => x.Items)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ThenByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        return Ok(orders.Select(ToResponse).ToList());
    }

    // Kitchen, Manager and Owner: view all orders.
    [Authorize(Roles = AppRoles.Staff)]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        CancellationToken cancellationToken)
    {
        var orders = await db.Orders
            .AsNoTracking()
            .Include(x => x.Items)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ThenByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        return Ok(orders.Select(ToResponse).ToList());
    }

    // Customer: own order. Staff: any order.
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(
        int id,
        CancellationToken cancellationToken)
    {
        var query = db.Orders
            .AsNoTracking()
            .Where(x => x.Id == id);

        var canReadAll =
            User.IsInRole(AppRoles.Kitchen)
            || User.IsInRole(AppRoles.Manager)
            || User.IsInRole(AppRoles.Owner);

        if (!canReadAll)
        {
            var customerId = UserId;

            if (string.IsNullOrWhiteSpace(customerId))
                return Unauthorized();

            query = query.Where(
                x => x.CustomerId == customerId);
        }

        var order = await query
            .Include(x => x.Items)
            .SingleOrDefaultAsync(cancellationToken);

        if (order is null)
            return NotFound();

        return Ok(ToResponse(order));
    }

    // Kitchen: advance work only (no cancel).
    // Manager and Owner: the full transition matrix.
    [Authorize(Roles = AppRoles.Staff)]
    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(
        int id,
        UpdateOrderStatusRequest req,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<OrderStatus>(
                req.Status,
                true,
                out var newStatus)
            || !Enum.IsDefined(typeof(OrderStatus), newStatus))
        {
            return BadRequest(new
            {
                message =
                    "Status must be Pending, Preparing, Ready, " +
                    "Completed or Cancelled."
            });
        }

        var isKitchenOnly =
            User.IsInRole(AppRoles.Kitchen)
            && !User.IsInRole(AppRoles.Manager)
            && !User.IsInRole(AppRoles.Owner);

        if (isKitchenOnly &&
            newStatus is not (OrderStatus.Preparing
                or OrderStatus.Ready))
        {
            return Forbid();
        }

        var order = await db.Orders.FindAsync(
            new object[] { id },
            cancellationToken);

        if (order is null)
            return NotFound();

        if (order.Status == newStatus)
            return NoContent();

        var allowed = order.Status switch
        {
            OrderStatus.Pending =>
                newStatus is OrderStatus.Preparing
                    or OrderStatus.Cancelled,

            OrderStatus.Preparing =>
                newStatus is OrderStatus.Ready
                    or OrderStatus.Cancelled,

            OrderStatus.Ready =>
                newStatus is OrderStatus.Completed
                    or OrderStatus.Cancelled,

            _ => false
        };

        if (!allowed)
        {
            return BadRequest(new
            {
                message =
                    "This order status transition is not allowed."
            });
        }

        order.Status = newStatus;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new
            {
                message =
                    "The order changed. Reload it and try again."
            });
        }

        return NoContent();
    }

    // Shared calculation for quotes and actual orders.
    private async Task<(PricingResult? Result, string? Error)>
        CalculateAsync(
            OrderType? type,
            List<OrderItemDto>? items,
            bool applyStaffDiscount)
    {
        if (!type.HasValue ||
            !Enum.IsDefined(typeof(OrderType), type.Value))
        {
            return (null, "Type must be Pickup or Delivery.");
        }

        if (items is null || items.Count < 1 || items.Count > 50)
        {
            return (
                null,
                "Order must contain between 1 and 50 items.");
        }

        if (items.Any(x =>
                x is null ||
                x.MenuItemId < 1 ||
                x.Quantity < 1 ||
                x.Quantity > 99))
        {
            return (null, "Invalid menu item or quantity.");
        }

        if (items.Any(x => x.Note is { Length: > 200 }))
        {
            return (
                null,
                "Item notes must not exceed 200 characters.");
        }

        var ids = items.Select(x => x.MenuItemId).ToList();

        if (ids.Distinct().Count() != ids.Count)
        {
            return (
                null,
                "Use one line per menu item and specify its quantity.");
        }

        var menuItems = await db.MenuItems
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id);

        if (menuItems.Count != ids.Count ||
            menuItems.Values.Any(x => !x.IsAvailable))
        {
            return (
                null,
                "One or more menu items do not exist or are unavailable.");
        }

        var orderItems = items.Select(line =>
        {
            var menuItem = menuItems[line.MenuItemId];

            return new OrderItem
            {
                MenuItemId = menuItem.Id,
                MenuItemName = menuItem.Name,
                UnitPrice = menuItem.Price,
                Quantity = line.Quantity,

                Note = string.IsNullOrWhiteSpace(line.Note)
                    ? null
                    : line.Note.Trim()
            };
        }).ToList();

        var subtotal = orderItems.Sum(
            x => x.UnitPrice * x.Quantity);

        var discount = applyStaffDiscount
            ? decimal.Round(
                subtotal * StaffDiscountRate,
                2,
                MidpointRounding.AwayFromZero)
            : 0m;

        // Free delivery is judged on the amount actually paid.
        var effectiveSubtotal = subtotal - discount;

        var deliveryFee =
            type.Value == OrderType.Delivery &&
            effectiveSubtotal < FreeDeliveryThreshold
                ? StandardDeliveryFee
                : 0m;

        return (
            new PricingResult(
                type.Value,
                orderItems,
                subtotal,
                discount,
                deliveryFee),
            null);
    }

    private static object ToResponse(Order order)
    {
        return new
        {
            order.Id,
            order.OrderDate,
            order.DailyNumber,
            order.Type,
            order.Status,
            order.CreatedAtUtc,
            order.CustomerName,
            order.CustomerPhone,
            order.DeliveryAddress,
            order.Notes,
            order.Subtotal,
            order.Discount,
            order.DeliveryFee,
            order.TotalAmount,

            items = ToItemsResponse(order.Items)
        };
    }

    private static object ToItemsResponse(
        IEnumerable<OrderItem> items)
    {
        return items
            .OrderBy(x => x.Id)
            .Select(x => new
            {
                x.MenuItemId,
                name = x.MenuItemName,
                x.UnitPrice,
                x.Quantity,
                lineTotal = x.UnitPrice * x.Quantity,
                x.Note
            })
            .ToList();
    }

    private sealed record PricingResult(
        OrderType Type,
        List<OrderItem> Items,
        decimal Subtotal,
        decimal Discount,
        decimal DeliveryFee)
    {
        public decimal TotalAmount
            => Subtotal - Discount + DeliveryFee;
    }
}