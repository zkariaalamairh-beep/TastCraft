using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TasteCraft.Contracts;
using TasteCraft.Data;
using TasteCraft.Models;

namespace TasteCraft.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class OrderReviewsController(AppDbContext db) : ControllerBase
{
    private string? CurrentUserId =>
        User.FindFirst("sub")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    // Customer: review an owned, completed order.
    [Authorize(Roles = AppRoles.Customer)]
    [HttpPost("orders/{orderId:int}/review")]
    public async Task<IActionResult> Create(
        int orderId,
        CreateOrderReviewRequest req,
        CancellationToken cancellationToken)
    {
        var customerId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(customerId))
            return Unauthorized();

        // Ownership is checked before returning order information.
        var order = await db.Orders
            .AsNoTracking()
            .Where(x =>
                x.Id == orderId &&
                x.CustomerId == customerId)
            .Select(x => new
            {
                x.Id,
                x.Status
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (order is null)
            return NotFound();

        if (order.Status != OrderStatus.Completed)
        {
            return BadRequest(new
            {
                message = "Only completed orders can be reviewed."
            });
        }

        var alreadyReviewed = await db.OrderReviews
            .AnyAsync(
                x => x.OrderId == orderId,
                cancellationToken);

        if (alreadyReviewed)
            return DuplicateReview();

        var review = new OrderReview
        {
            OrderId = order.Id,
            Rating = req.Rating,

            Comment = string.IsNullOrWhiteSpace(req.Comment)
                ? null
                : req.Comment.Trim(),

            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        db.OrderReviews.Add(review);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
            when (ex.InnerException is SqlException
            { Number: 2601 or 2627 })
        {
            // Handles concurrent requests reviewing the same order.
            return DuplicateReview();
        }

        var response = new OrderReviewResponse(
            review.Id,
            review.OrderId,
            review.Rating,
            review.Comment,
            review.CreatedAtUtc
        );

        return CreatedAtAction(
            nameof(GetByOrder),
            new { orderId = review.OrderId },
            response);
    }

    // Customer: own order review. Admin: any order review.
    [Authorize(Roles = AppRoles.Customer + "," + AppRoles.Management)]
    [HttpGet("orders/{orderId:int}/review")]
    public async Task<IActionResult> GetByOrder(
        int orderId,
        CancellationToken cancellationToken)
    {
        var query = db.OrderReviews
            .AsNoTracking()
            .Where(x => x.OrderId == orderId);

        if (!User.IsInRole(AppRoles.Management))
        {
            var customerId = CurrentUserId;

            if (string.IsNullOrWhiteSpace(customerId))
                return Unauthorized();

            query = query.Where(
                x => x.Order.CustomerId == customerId);
        }

        var review = await ToResponse(query)
            .SingleOrDefaultAsync(cancellationToken);

        if (review is null)
            return NotFound();

        return Ok(review);
    }

    // Public: guest reviews for the reviews page and home section.
    [AllowAnonymous]
    [HttpGet("reviews/home")]
    public async Task<IActionResult> GetHomeReviews(
        [FromQuery] int count = 12,
        CancellationToken cancellationToken = default)
    {
        if (count < 1 || count > 50)
            count = 12;

        var reviews = await db.OrderReviews
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .ThenByDescending(x => x.Id)
            .Take(count)
            .Select(x => new
            {
                x.Rating,
                x.Comment,
                x.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(reviews);
    }




    // Admin: list reviews with optional rating filtering.
    [Authorize(Roles = AppRoles.Management)]
    [HttpGet("reviews")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? rating = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (page < 1 || page > 10000 ||
            pageSize < 1 || pageSize > 100)
        {
            return BadRequest(new
            {
                message =
                    "Page must be between 1 and 10000, " +
                    "and pageSize must be between 1 and 100."
            });
        }

        if (rating.HasValue &&
            (rating.Value < 1 || rating.Value > 5))
        {
            return BadRequest(new
            {
                message = "Rating must be between 1 and 5."
            });
        }

        var query = db.OrderReviews.AsNoTracking();

        if (rating.HasValue)
        {
            query = query.Where(
                x => x.Rating == rating.Value);
        }

        var totalItems = await query.CountAsync(cancellationToken);

        var totalPages = (int)Math.Ceiling(
            totalItems / (double)pageSize);

        var pageQuery = query
            .OrderByDescending(x => x.CreatedAtUtc)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize);

        var items = await ToResponse(pageQuery)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            page,
            pageSize,
            totalItems,
            totalPages,
            items
        });
    }

    // Return review fields only, without navigation properties.
    private static IQueryable<OrderReviewResponse> ToResponse(
        IQueryable<OrderReview> query)
    {
        return query.Select(x => new OrderReviewResponse(
            x.Id,
            x.OrderId,
            x.Rating,
            x.Comment,
            x.CreatedAtUtc
        ));
    }

    private IActionResult DuplicateReview()
    {
        return Conflict(new
        {
            message = "This order has already been reviewed."
        });
    }
}