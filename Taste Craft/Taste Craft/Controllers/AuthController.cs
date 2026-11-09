using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using TasteCraft.Contracts;
using TasteCraft.Data;
using TasteCraft.Models;
using TasteCraft.Services;

namespace TasteCraft.Controllers;

[ApiController]
[Route("api/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AuthController(
    UserManager<AppUser> users,
    SignInManager<AppUser> signIn,
    AppDbContext db,
    TokenService tokenService,
    IAntiforgery antiforgery) : ControllerBase
{
    private const string RefreshCookieName =
        "__Host-TasteCraft.Refresh";

    private const string CsrfHeaderName = "X-CSRF-TOKEN";

    // Issue a CSRF request token and its matching protected cookie.
    [AllowAnonymous]
    [HttpGet("csrf")]
    public IActionResult GetCsrfToken()
    {
        var headerError = CheckCookieEndpointHeaders();

        if (headerError is not null)
            return headerError;

        var tokens = antiforgery.GetAndStoreTokens(HttpContext);

        return Ok(new
        {
            csrfToken = tokens.RequestToken
        });
    }

    // Public registration always creates a Customer.
    [AllowAnonymous]
    [HttpPost("register")]
    public Task<IActionResult> Register(RegisterRequest request)
    {
        return CreateAccountAsync(request, AppRoles.Customer);
    }

    // Manager and Owner: list every staff member with roles.
    [Authorize(Roles = AppRoles.Management)]
    [HttpGet("staff")]
    public async Task<IActionResult> GetStaff(
        CancellationToken cancellationToken)
    {
        var staffRoles = new[]
        {
            AppRoles.Kitchen,
            AppRoles.Manager,
            AppRoles.Owner
        };

        // A user may hold several roles; collect them once.
        var staffById = new Dictionary<string, AppUser>();

        foreach (var role in staffRoles)
        {
            var usersInRole = await users.GetUsersInRoleAsync(role);

            foreach (var staffUser in usersInRole)
            {
                staffById[staffUser.Id] = staffUser;
            }
        }

        var result = new List<object>();

        foreach (var staffUser in staffById.Values
            .OrderBy(x => x.FullName))
        {
            var roles = await users.GetRolesAsync(staffUser);

            result.Add(new
            {
                staffUser.Id,
                staffUser.FullName,
                staffUser.Email,
                Roles = roles
            });
        }

        return Ok(result);
    }

    // Manager creates Kitchen accounts.
    // Owner creates Kitchen and Manager accounts.
    [Authorize(Roles = AppRoles.Management)]
    [HttpPost("staff")]
    public async Task<IActionResult> CreateStaff(
        CreateStaffRequest request)
    {
        var canCreateManagers =
            User.IsInRole(AppRoles.Owner);

        var allowedRoles = canCreateManagers
            ? new[] { AppRoles.Kitchen, AppRoles.Manager }
            : new[] { AppRoles.Kitchen };

        var requestedRole = allowedRoles.FirstOrDefault(
            role => string.Equals(
                role,
                request.Role.Trim(),
                StringComparison.OrdinalIgnoreCase));

        if (requestedRole is null)
        {
            return BadRequest(new
            {
                message = canCreateManagers
                    ? "Role must be Kitchen or Manager."
                    : "Managers can only create Kitchen accounts."
            });
        }

        return await CreateAccountAsync(
            new RegisterRequest(
                request.FullName,
                request.Email,
                request.Password),
            requestedRole);
    }

    // NEW: Owner only — change a staff member's role.
    [Authorize(Roles = AppRoles.Owner)]
    [HttpPut("staff/{id}/role")]
    public async Task<IActionResult> UpdateStaffRole(
        string id,
        UpdateStaffRoleRequest request)
    {
        var currentUserId = User.FindFirstValue("sub")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        // Changing your own role could lock you out.
        if (string.Equals(
                id,
                currentUserId,
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message = "You cannot change your own role."
            });
        }

        var target = await users.FindByIdAsync(id);

        if (target is null)
            return NotFound();

        var targetRoles = await users.GetRolesAsync(target);

        var isStaff = targetRoles.Any(role =>
            role is AppRoles.Kitchen
                or AppRoles.Manager
                or AppRoles.Owner);

        if (!isStaff)
        {
            return BadRequest(new
            {
                message = "This account is not a staff member."
            });
        }

        // Owners sit outside the scope of role changes.
        if (targetRoles.Contains(AppRoles.Owner))
        {
            return BadRequest(new
            {
                message = "Owner accounts cannot be changed."
            });
        }

        var newRole = request.Role.Trim();

        if (newRole is not (AppRoles.Kitchen or AppRoles.Manager))
        {
            return BadRequest(new
            {
                message = "Role must be Kitchen or Manager."
            });
        }

        if (targetRoles.Contains(newRole))
            return NoContent();

        await using var transaction =
            await db.Database.BeginTransactionAsync();

        // Swap the old staff role for the new one.
        foreach (var role in targetRoles.Where(role =>
            role is AppRoles.Kitchen or AppRoles.Manager))
        {
            await users.RemoveFromRoleAsync(target, role);
        }

        var addResult = await users.AddToRoleAsync(target, newRole);

        if (!addResult.Succeeded)
        {
            return Problem("Could not assign the new role.");
        }

        // Roles are baked into access tokens:
        // revoke their sessions so the next sign-in picks up the new role.
        await tokenService.RevokeAllForUserAsync(target.Id);

        await transaction.CommitAsync();

        return NoContent();
    }

    // Sign in and create a refresh session.
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
        LoginRequest request,
        [FromHeader(Name = CsrfHeaderName)] string? csrfToken,
        CancellationToken cancellationToken)
    {
        var csrfError = await ValidateCsrfAsync(csrfToken);

        if (csrfError is not null)
            return csrfError;

        var user = await users.FindByEmailAsync(
            request.Email.Trim());

        if (user is null)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        var passwordResult = await signIn.CheckPasswordSignInAsync(
            user,
            request.Password,
            lockoutOnFailure: true);

        if (!passwordResult.Succeeded)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        await using var transaction =
            await db.Database.BeginTransactionAsync(cancellationToken);

        // Replace any previous refresh session in this browser.
        await tokenService.LogoutAsync(
            Request.Cookies[RefreshCookieName],
            cancellationToken);

        var result = await tokenService.CreateSessionAsync(
            user,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        WriteRefreshCookie(result);

        // Never return the raw refresh token in JSON.
        return Ok(result.Response);
    }

    // Renew tokens using the refresh cookie.
    // An access token is not required.
    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(
        [FromHeader(Name = CsrfHeaderName)] string? csrfToken,
        CancellationToken cancellationToken)
    {
        var csrfError = await ValidateCsrfAsync(csrfToken);

        if (csrfError is not null)
            return csrfError;

        var result = await tokenService.RefreshAsync(
            Request.Cookies[RefreshCookieName],
            cancellationToken);

        if (result is null)
        {
            DeleteRefreshCookie();

            return Unauthorized(new
            {
                message =
                    "The session is invalid or expired. " +
                    "Please sign in again."
            });
        }

        // Rotation replaces the old refresh cookie.
        WriteRefreshCookie(result);

        return Ok(result.Response);
    }

    // Revoke the current refresh session and remove its cookie.
    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(
        [FromHeader(Name = CsrfHeaderName)] string? csrfToken,
        CancellationToken cancellationToken)
    {
        var csrfError = await ValidateCsrfAsync(csrfToken);

        if (csrfError is not null)
            return csrfError;

        await tokenService.LogoutAsync(
            Request.Cookies[RefreshCookieName],
            cancellationToken);

        DeleteRefreshCookie();

        return NoContent();
    }

    // Change the authenticated user's password.
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue("sub")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized();

        var user = await users.FindByIdAsync(userId);

        if (user is null)
            return Unauthorized();

        if (request.CurrentPassword == request.NewPassword)
        {
            return BadRequest(new
            {
                message = "Choose a different new password."
            });
        }

        await using var transaction =
            await db.Database.BeginTransactionAsync(cancellationToken);

        var result = await users.ChangePasswordAsync(
            user,
            request.CurrentPassword,
            request.NewPassword);

        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                errors = result.Errors.Select(x => x.Description)
            });
        }

        // Revoke refresh sessions on all devices.
        await tokenService.RevokeAllForUserAsync(
            user.Id,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        DeleteRefreshCookie();

        return Ok(new
        {
            message =
                "Password changed successfully. " +
                "Please sign in again."
        });
    }

    private async Task<IActionResult> CreateAccountAsync(
        RegisterRequest request,
        string role)
    {
        await using var transaction =
            await db.Database.BeginTransactionAsync();

        var email = request.Email.Trim();

        var user = new AppUser
        {
            FullName = request.FullName.Trim(),
            UserName = email,
            Email = email
        };

        var result = await users.CreateAsync(
            user,
            request.Password);

        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                errors = result.Errors.Select(x => x.Description)
            });
        }

        var roleResult = await users.AddToRoleAsync(user, role);

        if (!roleResult.Succeeded)
        {
            return Problem("Could not assign the account role.");
        }

        await transaction.CommitAsync();

        return StatusCode(StatusCodes.Status201Created, new
        {
            user.Id,
            user.FullName,
            user.Email,
            role
        });
    }

    // Cookie endpoints deliberately do not use Bearer authentication.
    // This keeps their CSRF tokens independent of JWT identity/expiry.
    private IActionResult? CheckCookieEndpointHeaders()
    {
        if (Request.Headers.ContainsKey("Authorization"))
        {
            return BadRequest(new
            {
                message =
                    "Call /api/auth/csrf, /login, /refresh and /logout " +
                    "without an Authorization header."
            });
        }

        return null;
    }

    private async Task<IActionResult?> ValidateCsrfAsync(
        string? csrfToken)
    {
        var headerError = CheckCookieEndpointHeaders();

        if (headerError is not null)
            return headerError;

        if (string.IsNullOrWhiteSpace(csrfToken))
        {
            return BadRequest(new
            {
                message =
                    "Missing CSRF token. Get one from /api/auth/csrf " +
                    "and send it in the X-CSRF-TOKEN header."
            });
        }

        try
        {
            // Validates both the request token and matching cookie.
            await antiforgery.ValidateRequestAsync(HttpContext);

            return null;
        }
        catch (AntiforgeryValidationException)
        {
            return BadRequest(new
            {
                message =
                    "Invalid CSRF token. " +
                    "Request a new one from /api/auth/csrf."
            });
        }
    }

    private void WriteRefreshCookie(TokenIssueResult result)
    {
        var options = RefreshCookieOptions();

        options.Expires = result.RefreshTokenExpiresAtUtc;

        Response.Cookies.Append(
            RefreshCookieName,
            result.RawRefreshToken,
            options);
    }

    private void DeleteRefreshCookie()
    {
        Response.Cookies.Delete(
            RefreshCookieName,
            RefreshCookieOptions());
    }

    private static CookieOptions RefreshCookieOptions()
    {
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            IsEssential = true
        };
    }
}