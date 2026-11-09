using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using TasteCraft.Contracts;
using TasteCraft.Data;
using TasteCraft.Models;

namespace TasteCraft.Controllers;

[ApiController]
[Route("api/menu-items")]
public class MenuItemsController(
    AppDbContext db,
    IWebHostEnvironment environment) : ControllerBase
{



    // Public: list menu items
    // Public: search, filter and paginate menu items
    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] int? categoryId = null,
        [FromQuery] bool? isFeatured = null,
        [FromQuery] bool? isAvailable = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
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

        if (categoryId.HasValue && categoryId.Value < 1)
        {
            return BadRequest(new
            {
                message = "CategoryId must be a positive number."
            });
        }

        var searchTerm = search?.Trim();

        if (searchTerm is not null && searchTerm.Length > 120)
        {
            return BadRequest(new
            {
                message = "Search text must not exceed 120 characters."
            });
        }

        var query = db.MenuItems.AsNoTracking();

        // Search by name or description.
        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            query = query.Where(x =>
                x.Name.Contains(searchTerm) ||
                x.Description.Contains(searchTerm));
        }

        // Filter by category.
        if (categoryId.HasValue)
        {
            query = query.Where(
                x => x.CategoryId == categoryId.Value);
        }

        // Filter featured items only when explicitly requested.
        if (isFeatured.HasValue)
        {
            query = query.Where(
                x => x.IsFeatured == isFeatured.Value);
        }

        // Filter availability only when explicitly requested.
        if (isAvailable.HasValue)
        {
            query = query.Where(
                x => x.IsAvailable == isAvailable.Value);
        }

        // Count matching items before applying pagination.
        var totalItems = await query.CountAsync(cancellationToken);

        var totalPages = (int)Math.Ceiling(
            totalItems / (double)pageSize);

        var pageQuery = query
            .OrderByDescending(x => x.IsFeatured)
            .ThenBy(x => x.Id)
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
    // Public: get one menu item
    [AllowAnonymous]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await ToResponse(
                db.MenuItems
                    .AsNoTracking()
                    .Where(x => x.Id == id))
            .SingleOrDefaultAsync();

        if (item is null)
            return NotFound();

        return Ok(item);
    }




    // Management: upload a menu item image from disk.
    // Returns a public URL stored in ImageUrl afterwards.
    [Authorize(Roles = AppRoles.Management)]
    [HttpPost("upload-image")]
    [RequestSizeLimit(5 * 1024 * 1024)] // 5 MB
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new
            {
                message = "No file was received."
            });
        }

        // Only image types we trust.
        var allowedExtensions = new[]
        {
            ".jpg", ".jpeg", ".png", ".webp"
        };

        var extension = Path.GetExtension(file.FileName)
            .ToLowerInvariant();

        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest(new
            {
                message =
                    "Only .jpg, .png and .webp images are allowed."
            });
        }

        if (file.Length > 5 * 1024 * 1024)
        {
            return BadRequest(new
            {
                message = "Image must be 5 MB or smaller."
            });
        }

        // Random name: never trust the client file name.
        var fileName = $"{Guid.NewGuid():N}{extension}";

        var uploadsRoot = Path.Combine(
            environment.WebRootPath ?? "wwwroot",
            "uploads",
            "menu");

        Directory.CreateDirectory(uploadsRoot);

        var fullPath = Path.Combine(uploadsRoot, fileName);

        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        // Build a full public URL for the saved file.
        var url = $"{Request.Scheme}://{Request.Host}" +
                  $"/uploads/menu/{fileName}";

        return Ok(new { url });
    }

    // Admin: create a menu item
    [Authorize(Roles = AppRoles.Management)]
    [HttpPost]
    public async Task<IActionResult> Create(CreateMenuItemRequest req)
    {
        var categoryExists = await db.Categories
            .AnyAsync(x => x.Id == req.CategoryId);

        if (!categoryExists)
        {
            return BadRequest(new
            {
                message = "Category does not exist."
            });
        }

        var item = new MenuItem
        {
            Name = req.Name.Trim(),
            Description = req.Description.Trim(),

            Price = decimal.Round(
                req.Price, 2, MidpointRounding.AwayFromZero),

            ImageUrl = string.IsNullOrWhiteSpace(req.ImageUrl)
                ? null
                : req.ImageUrl.Trim(),

            IsFeatured = req.IsFeatured,
            IsAvailable = true,
            CategoryId = req.CategoryId
        };

        db.MenuItems.Add(item);
        await db.SaveChangesAsync();

        var response = await ToResponse(
                db.MenuItems
                    .AsNoTracking()
                    .Where(x => x.Id == item.Id))
            .SingleAsync();

        return CreatedAtAction(
            nameof(GetById),
            new { id = item.Id },
            response);
    }

    // Admin: update menu item details
    [Authorize(Roles = AppRoles.Management)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        UpdateMenuItemRequest req)
    {
        var item = await db.MenuItems.FindAsync(id);

        if (item is null)
            return NotFound();

        var categoryExists = await db.Categories
            .AnyAsync(x => x.Id == req.CategoryId);

        if (!categoryExists)
        {
            return BadRequest(new
            {
                message = "Category does not exist."
            });
        }

        item.Name = req.Name.Trim();
        item.Description = req.Description.Trim();

        item.Price = decimal.Round(
            req.Price, 2, MidpointRounding.AwayFromZero);

        item.ImageUrl = string.IsNullOrWhiteSpace(req.ImageUrl)
            ? null
            : req.ImageUrl.Trim();

        item.IsFeatured = req.IsFeatured;
        item.CategoryId = req.CategoryId;

        // Availability is managed through its own endpoint.
        await db.SaveChangesAsync();

        return NoContent();
    }

    // Admin: enable or disable ordering a menu item
    [Authorize(Roles = AppRoles.Management)]
    [HttpPatch("{id:int}/availability")]
    public async Task<IActionResult> UpdateAvailability(
        int id,
        UpdateMenuItemAvailabilityRequest req)
    {
        if (req.IsAvailable is null)
        {
            return BadRequest(new
            {
                message = "IsAvailable is required."
            });
        }

        var item = await db.MenuItems.FindAsync(id);

        if (item is null)
            return NotFound();

        item.IsAvailable = req.IsAvailable.Value;

        await db.SaveChangesAsync();

        return NoContent();
    }

    // Admin: delete only items that are not linked to orders
    [Authorize(Roles = AppRoles.Management)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await db.MenuItems.FindAsync(id);

        if (item is null)
            return NotFound();

        var hasOrders = await db.OrderItems
            .AnyAsync(x => x.MenuItemId == id);

        if (hasOrders)
        {
            return Conflict(new
            {
                message =
                    "This menu item is linked to orders. " +
                    "Set IsAvailable to false instead."
            });
        }

        db.MenuItems.Remove(item);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
            when (ex.InnerException is SqlException { Number: 547 })
        {
            // A reference may have been added after the check above.
            return Conflict(new
            {
                message =
                    "This menu item is referenced by other data. " +
                    "Set IsAvailable to false instead."
            });
        }

        return NoContent();
    }

    // Project only the fields needed by the frontend.
    private static IQueryable<MenuItemResponse> ToResponse(
        IQueryable<MenuItem> query)
    {
        return query.Select(x => new MenuItemResponse(
            x.Id,
            x.Name,
            x.Description,
            x.Price,
            x.ImageUrl,
            x.IsAvailable,
            x.IsFeatured,
            x.CategoryId,
            x.Category.Name
        ));
    }
}