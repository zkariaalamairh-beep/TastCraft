using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using TasteCraft.Contracts;
using TasteCraft.Data;
using TasteCraft.Models;

namespace TasteCraft.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoriesController(AppDbContext db) : ControllerBase
{
    // Public: list categories
    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var query = db.Categories
            .AsNoTracking()
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.Id);

        var categories = await ToResponse(query).ToListAsync();

        return Ok(categories);
    }

    // Public: get one category
    [AllowAnonymous]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var category = await ToResponse(
                db.Categories
                    .AsNoTracking()
                    .Where(x => x.Id == id))
            .SingleOrDefaultAsync();

        if (category is null)
            return NotFound();

        return Ok(category);
    }

    // Admin: create a category
    [Authorize(Roles = AppRoles.Management)]
    [HttpPost]
    public async Task<IActionResult> Create(CreateCategoryRequest req)
    {
        var name = req.Name.Trim();

        var nameExists = await db.Categories
            .AnyAsync(x => x.Name == name);

        if (nameExists)
            return DuplicateName();

        var category = new Category
        {
            Name = name,

            ImageUrl = string.IsNullOrWhiteSpace(req.ImageUrl)
                ? null
                : req.ImageUrl.Trim(),

            DisplayOrder = req.DisplayOrder
        };

        db.Categories.Add(category);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
            when (ex.InnerException is SqlException
            { Number: 2601 or 2627 })
        {
            // Another request may have used the same name.
            return DuplicateName();
        }

        var response = new CategoryResponse(
            category.Id,
            category.Name,
            category.ImageUrl,
            category.DisplayOrder
        );

        return CreatedAtAction(
            nameof(GetById),
            new { id = category.Id },
            response);
    }

    // Admin: update a category
    [Authorize(Roles = AppRoles.Management)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        CreateCategoryRequest req)
    {
        var category = await db.Categories.FindAsync(id);

        if (category is null)
            return NotFound();

        var name = req.Name.Trim();

        var nameExists = await db.Categories
            .AnyAsync(x => x.Id != id && x.Name == name);

        if (nameExists)
            return DuplicateName();

        category.Name = name;

        category.ImageUrl = string.IsNullOrWhiteSpace(req.ImageUrl)
            ? null
            : req.ImageUrl.Trim();

        category.DisplayOrder = req.DisplayOrder;

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
            when (ex.InnerException is SqlException
            { Number: 2601 or 2627 })
        {
            return DuplicateName();
        }

        return NoContent();
    }

    // Admin: delete an empty category
    [Authorize(Roles = AppRoles.Management)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await db.Categories.FindAsync(id);

        if (category is null)
            return NotFound();

        var hasMenuItems = await db.MenuItems
            .AnyAsync(x => x.CategoryId == id);

        if (hasMenuItems)
        {
            return Conflict(new
            {
                message =
                    "This category contains menu items. " +
                    "Move them to another category before deleting it."
            });
        }

        db.Categories.Remove(category);

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
                    "This category is referenced by other data " +
                    "and cannot be deleted."
            });
        }

        return NoContent();
    }

    // Return only the fields needed by the frontend.
    private static IQueryable<CategoryResponse> ToResponse(
        IQueryable<Category> query)
    {
        return query.Select(x => new CategoryResponse(
            x.Id,
            x.Name,
            x.ImageUrl,
            x.DisplayOrder
        ));
    }

    private IActionResult DuplicateName()
    {
        return Conflict(new
        {
            message = "A category with this name already exists."
        });
    }
}