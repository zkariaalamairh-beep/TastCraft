# 🍽️ Taste Craft — Restaurant Ordering Platform

A full-stack restaurant ordering system with a real-time kitchen
workflow, staff management, and customer loyalty features.

**Stack:** ASP.NET Core 8 Web API · SQL Server (EF Core) · React 19 (Vite)

---

## ✨ Features

### 👥 Four-role access system
| Role | Powers |
|------|--------|
| 🧑 **Customer** | Browse, order with customizations, track live, review |
| 👨‍🍳 **Kitchen** | See all tickets, advance Pending → Preparing → Ready |
| 🧑‍💼 **Manager** | Full order control, menu management, create Kitchen staff, 20% discount |
| 👑 **Owner** | Everything + create Managers + change staff roles |

### 🔐 Security
- JWT access tokens (15 min) + rotating refresh tokens (7 days, HttpOnly cookie)
- CSRF protection on all cookie endpoints (`X-CSRF-TOKEN`)
- Token hash storage (SHA-256) — raw tokens never touch the database
- Role changes revoke all user sessions automatically
- Account lockout after 5 failed attempts

### 🍕 Restaurant operations
- Menu with categories, images (**uploaded from device**), availability toggle
- Cart with per-item customization (sauces, adjustments, notes)
- Live server-side pricing (`/orders/quote`) — the browser is never trusted
- Daily order numbers that reset each day (`#1, #2, ...`)
- Staff discount (20%) applied automatically for Manager/Owner orders
- Free delivery over $50, order status stepper with live updates
- Star reviews with comments — featured on the public home page
- Admin dashboard with live restaurant statistics

---

## 🚀 Running the project

### Backend (TasteCraft API)
```bash
# Configure secrets once:
dotnet user-secrets set "Jwt:Key" "<32+ char key>"
dotnet user-secrets set "Jwt:Issuer" "TasteCraft"
dotnet user-secrets set "Jwt:Audience" "TasteCraftClient"
dotnet user-secrets set "BootstrapAdmin:Email" "admin@example.com"
dotnet user-secrets set "BootstrapAdmin:Password" "<10+ chars>"

dotnet ef database update   # if needed
dotnet run                  # → https://localhost:7258