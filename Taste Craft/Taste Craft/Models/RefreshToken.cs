namespace TasteCraft.Models;

public class RefreshToken
{
    public long Id { get; set; }

    public string UserId { get; set; } = string.Empty;
    public AppUser User { get; set; } = null!;

    // All token rotations from one login share this session ID.
    public Guid SessionId { get; set; }

    // Store the SHA-256 hash, never the raw refresh token.
    public string TokenHash { get; set; } = string.Empty;

    // Used to check whether account security details have changed.
    public string UserSecurityStamp { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;

    // The session's absolute expiration time.
    public DateTimeOffset ExpiresAtUtc { get; set; }

    public DateTimeOffset? RevokedAtUtc { get; set; }

    // Records which token replaced this one during rotation.
    public string? ReplacedByTokenHash { get; set; }

    // Used to detect concurrent attempts to rotate the same token.
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}