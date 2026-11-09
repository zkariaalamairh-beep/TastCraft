using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TasteCraft.Contracts;
using TasteCraft.Data;
using TasteCraft.Models;

namespace TasteCraft.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = AppRoles.Management)]
public class DashboardController(
    AppDbContext db,
    IConfiguration configuration) : ControllerBase
{
    // Manager and Owner: overall dashboard statistics.
    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryResponse>> GetSummary(
        CancellationToken cancellationToken)
    {
        var today = RestaurantToday();

        // Orders placed on the restaurant's current day.
        var todayOrders = await db.Orders
            .AsNoTracking()
            .CountAsync(
                x => x.OrderDate == today,
                cancellationToken);

        // Order statistics
        var orderStats = await db.Orders
            .AsNoTracking()
            .GroupBy(x => 1)
            .Select(group => new
            {
                TotalOrders = group.Count(),

                PendingOrders = group.Count(
                    x => x.Status == OrderStatus.Pending),

                PreparingOrders = group.Count(
                    x => x.Status == OrderStatus.Preparing),

                ReadyOrders = group.Count(
                    x => x.Status == OrderStatus.Ready),

                CompletedOrders = group.Count(
                    x => x.Status == OrderStatus.Completed),

                CancelledOrders = group.Count(
                    x => x.Status == OrderStatus.Cancelled),

                CompletedOrdersTotal = group.Sum(
                    x => x.Status == OrderStatus.Completed
                        ? x.TotalAmount
                        : 0m)
            })
            .SingleOrDefaultAsync(cancellationToken);

        // Menu statistics
        var menuStats = await db.MenuItems
            .AsNoTracking()
            .GroupBy(x => 1)
            .Select(group => new
            {
                TotalMenuItems = group.Count(),

                AvailableMenuItems = group.Count(
                    x => x.IsAvailable),

                UnavailableMenuItems = group.Count(
                    x => !x.IsAvailable)
            })
            .SingleOrDefaultAsync(cancellationToken);

        // Category count
        var totalCategories = await db.Categories
            .CountAsync(cancellationToken);

        // Review statistics, calculated in the database.
        var reviewStats = await db.OrderReviews
            .AsNoTracking()
            .GroupBy(x => 1)
            .Select(group => new
            {
                TotalReviews = group.Count(),

                AverageRating = group.Average(
                    x => (decimal)x.Rating)
            })
            .SingleOrDefaultAsync(cancellationToken);

        // No reviews means no average rating, not a zero-star rating.
        decimal? averageRating = reviewStats is null
            ? null
            : decimal.Round(
                reviewStats.AverageRating,
                2,
                MidpointRounding.AwayFromZero);

        var response = new DashboardSummaryResponse(
            TodayOrders:
                todayOrders,

            TotalOrders:
                orderStats?.TotalOrders ?? 0,

            PendingOrders:
                orderStats?.PendingOrders ?? 0,

            PreparingOrders:
                orderStats?.PreparingOrders ?? 0,

            ReadyOrders:
                orderStats?.ReadyOrders ?? 0,

            CompletedOrders:
                orderStats?.CompletedOrders ?? 0,

            CancelledOrders:
                orderStats?.CancelledOrders ?? 0,

            CompletedOrdersTotal:
                orderStats?.CompletedOrdersTotal ?? 0m,

            TotalMenuItems:
                menuStats?.TotalMenuItems ?? 0,

            AvailableMenuItems:
                menuStats?.AvailableMenuItems ?? 0,

            UnavailableMenuItems:
                menuStats?.UnavailableMenuItems ?? 0,

            TotalCategories:
                totalCategories,

            TotalReviews:
                reviewStats?.TotalReviews ?? 0,

            AverageRating:
                averageRating
        );

        return Ok(response);
    }

    // The restaurant's local calendar day.
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
}