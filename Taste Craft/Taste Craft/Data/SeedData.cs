using Microsoft.AspNetCore.Identity;
using TasteCraft.Models;

namespace TasteCraft.Data;

public static class SeedData
{
    public static async Task CreateAdminAsync(
        IServiceProvider services,
        IConfiguration configuration)
    {
        var email = configuration["BootstrapAdmin:Email"];
        var password = configuration["BootstrapAdmin:Password"];

        if (string.IsNullOrWhiteSpace(email))
            return;

        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Set BootstrapAdmin:Password in User Secrets.");
        }

        using var scope = services.CreateScope();

        var users = scope.ServiceProvider
            .GetRequiredService<UserManager<AppUser>>();

        var roles = scope.ServiceProvider
            .GetRequiredService<RoleManager<IdentityRole>>();

        var db = scope.ServiceProvider
            .GetRequiredService<AppDbContext>();

        // One-time move from the old role names.
        await MigrateLegacyRolesAsync(users, roles);

        var existing = await users.FindByEmailAsync(email);

        if (existing is null)
        {
            await using var transaction =
                await db.Database.BeginTransactionAsync();

            var admin = new AppUser
            {
                FullName = "Taste Craft Admin",
                UserName = email,
                Email = email
            };

            EnsureSuccess(await users.CreateAsync(admin, password));

            EnsureSuccess(await users.AddToRoleAsync(
                admin, AppRoles.Manager));

            EnsureSuccess(await users.AddToRoleAsync(
                admin, AppRoles.Owner));

            await transaction.CommitAsync();

            return;
        }

        // The bootstrap account is always Manager + Owner.
        if (!await users.IsInRoleAsync(existing, AppRoles.Manager))
        {
            EnsureSuccess(await users.AddToRoleAsync(
                existing, AppRoles.Manager));
        }

        if (!await users.IsInRoleAsync(existing, AppRoles.Owner))
        {
            EnsureSuccess(await users.AddToRoleAsync(
                existing, AppRoles.Owner));
        }
    }

    private static async Task MigrateLegacyRolesAsync(
        UserManager<AppUser> users,
        RoleManager<IdentityRole> roles)
    {
        // Admin -> Manager + Owner
        if (await roles.RoleExistsAsync("Admin"))
        {
            foreach (var user in await users.GetUsersInRoleAsync("Admin"))
            {
                if (!await users.IsInRoleAsync(user, AppRoles.Manager))
                    await users.AddToRoleAsync(user, AppRoles.Manager);

                if (!await users.IsInRoleAsync(user, AppRoles.Owner))
                    await users.AddToRoleAsync(user, AppRoles.Owner);
            }
        }

        // Employee -> Kitchen
        if (await roles.RoleExistsAsync("Employee"))
        {
            foreach (var user in await users.GetUsersInRoleAsync("Employee"))
            {
                if (!await users.IsInRoleAsync(user, AppRoles.Kitchen))
                    await users.AddToRoleAsync(user, AppRoles.Kitchen);
            }
        }
    }

    private static void EnsureSuccess(IdentityResult result)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                string.Join("; ",
                    result.Errors.Select(x => x.Description)));
        }
    }
}