using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TasteCraft.Contracts;
using TasteCraft.Data;
using TasteCraft.Models;

namespace TasteCraft.Services;

public sealed class TokenService(
    AppDbContext db,
    UserManager<AppUser> users,
    IConfiguration configuration)
{
    // Call only after successful authentication.
    public async Task<TokenIssueResult> CreateSessionAsync(
        AppUser user,
        CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var securityStamp = await users.GetSecurityStampAsync(user);

        if (string.IsNullOrWhiteSpace(securityStamp))
        {
            throw new InvalidOperationException(
                "User security stamp is missing.");
        }

        var (refreshToken, rawToken) = CreateRefreshToken(
            user,
            Guid.NewGuid(),
            securityStamp,
            now,
            now.AddDays(7));

        var result = await BuildResultAsync(
            user,
            refreshToken,
            rawToken);

        db.RefreshTokens.Add(refreshToken);

        await db.SaveChangesAsync(cancellationToken);

        return result;
    }

    // Rotate a refresh token and issue a new access token.
    public async Task<TokenIssueResult?> RefreshAsync(
        string? rawToken,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = GetIncomingTokenHash(rawToken);

        if (tokenHash is null)
            return null;

        var currentToken = await db.RefreshTokens
            .Include(x => x.User)
            .SingleOrDefaultAsync(
                x => x.TokenHash == tokenHash,
                cancellationToken);

        if (currentToken is null)
            return null;

        var now = DateTimeOffset.UtcNow;

        // Reusing a revoked token invalidates its entire session.
        if (currentToken.RevokedAtUtc.HasValue)
        {
            await RevokeSessionAsync(
                currentToken.SessionId,
                cancellationToken);

            return null;
        }

        if (currentToken.ExpiresAtUtc <= now)
            return null;

        var user = currentToken.User;

        var currentSecurityStamp =
            await users.GetSecurityStampAsync(user);

        var securityStampMatches = string.Equals(
            currentToken.UserSecurityStamp,
            currentSecurityStamp,
            StringComparison.Ordinal);

        if (!securityStampMatches ||
            await users.IsLockedOutAsync(user))
        {
            await RevokeSessionAsync(
                currentToken.SessionId,
                cancellationToken);

            return null;
        }

        // Keep the same session ID and absolute expiration time.
        var (replacement, replacementRawToken) = CreateRefreshToken(
            user,
            currentToken.SessionId,
            currentToken.UserSecurityStamp,
            now,
            currentToken.ExpiresAtUtc);

        var result = await BuildResultAsync(
            user,
            replacement,
            replacementRawToken);

        currentToken.RevokedAtUtc = now;
        currentToken.ReplacedByTokenHash = replacement.TokenHash;

        db.RefreshTokens.Add(replacement);

        try
        {
            // Revocation and insertion are saved atomically.
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Another request changed the token during rotation.
            // Discard the failed changes before revoking the session.
            db.ChangeTracker.Clear();

            await RevokeSessionAsync(
                currentToken.SessionId,
                cancellationToken);

            return null;
        }

        return result;
    }

    // Revoke the session identified by its refresh token.
    public async Task LogoutAsync(
        string? rawToken,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = GetIncomingTokenHash(rawToken);

        if (tokenHash is null)
            return;

        var sessionId = await db.RefreshTokens
            .AsNoTracking()
            .Where(x => x.TokenHash == tokenHash)
            .Select(x => (Guid?)x.SessionId)
            .SingleOrDefaultAsync(cancellationToken);

        if (sessionId.HasValue)
        {
            await RevokeSessionAsync(
                sessionId.Value,
                cancellationToken);
        }
    }

    // Revoke all refresh sessions after a password change.
    public async Task RevokeAllForUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        await db.RefreshTokens
            .Where(x =>
                x.UserId == userId &&
                x.RevokedAtUtc == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    x => x.RevokedAtUtc,
                    (DateTimeOffset?)now),
                cancellationToken);
    }

    private async Task RevokeSessionAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        await db.RefreshTokens
            .Where(x =>
                x.SessionId == sessionId &&
                x.RevokedAtUtc == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    x => x.RevokedAtUtc,
                    (DateTimeOffset?)now),
                cancellationToken);
    }

    private async Task<TokenIssueResult> BuildResultAsync(
        AppUser user,
        RefreshToken refreshToken,
        string rawRefreshToken)
    {
        // Read current roles instead of copying old token claims.
        var roles = await users.GetRolesAsync(user);

        var now = DateTimeOffset.UtcNow;
        var expiresAtUtc = now.AddMinutes(15);

        // Do not issue access tokens beyond the session's lifetime.
        if (expiresAtUtc > refreshToken.ExpiresAtUtc)
        {
            expiresAtUtc = refreshToken.ExpiresAtUtc;
        }

        var claims = new List<Claim>
        {
            new("sub", user.Id),
            new("name", user.FullName),
            new("jti", Guid.NewGuid().ToString()),
            new("sid", refreshToken.SessionId.ToString())
        };

        claims.AddRange(
            roles.Select(role => new Claim("role", role)));

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(
                GetRequiredSetting("Jwt:Key")));

        var jwt = new JwtSecurityToken(
            issuer: GetRequiredSetting("Jwt:Issuer"),
            audience: GetRequiredSetting("Jwt:Audience"),
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expiresAtUtc.UtcDateTime,
            signingCredentials: new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256));

        var accessToken =
            new JwtSecurityTokenHandler().WriteToken(jwt);

        var response = new AuthResponse(
            AccessToken: accessToken,
            ExpiresAtUtc: expiresAtUtc,
            User: new AuthUserResponse(
                Id: user.Id,
                FullName: user.FullName,
                Email: user.Email,
                Roles: roles.ToArray()
            )
        );

        return new TokenIssueResult(
            Response: response,
            RawRefreshToken: rawRefreshToken,
            RefreshTokenExpiresAtUtc: refreshToken.ExpiresAtUtc
        );
    }

    private static (RefreshToken Token, string RawToken)
        CreateRefreshToken(
            AppUser user,
            Guid sessionId,
            string securityStamp,
            DateTimeOffset createdAtUtc,
            DateTimeOffset expiresAtUtc)
    {
        // 64 cryptographically random bytes.
        var rawToken = Base64UrlEncoder.Encode(
            RandomNumberGenerator.GetBytes(64));

        var token = new RefreshToken
        {
            UserId = user.Id,
            SessionId = sessionId,
            TokenHash = HashToken(rawToken),
            UserSecurityStamp = securityStamp,
            CreatedAtUtc = createdAtUtc,
            ExpiresAtUtc = expiresAtUtc
        };

        return (token, rawToken);
    }

    private static string? GetIncomingTokenHash(string? rawToken)
    {
        // 64 bytes become 86 unpadded Base64Url characters.
        if (rawToken is null || rawToken.Length != 86)
            return null;

        return HashToken(rawToken);
    }

    private static string HashToken(string rawToken)
    {
        var bytes = Encoding.UTF8.GetBytes(rawToken);
        var hash = SHA256.HashData(bytes);

        return Convert.ToHexString(hash);
    }

    private string GetRequiredSetting(string name)
    {
        var value = configuration[name];

        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(
                $"Missing configuration: {name}.");
        }

        return value;
    }
}

// Internal service result.
// The raw refresh token must be written to a protected cookie,
// not included in the JSON response.
public sealed record TokenIssueResult(
    AuthResponse Response,

    [property: JsonIgnore]
    string RawRefreshToken,

    [property: JsonIgnore]
    DateTimeOffset RefreshTokenExpiresAtUtc
);