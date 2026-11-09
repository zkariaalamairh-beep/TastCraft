import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container site-footer-grid">
        <div className="site-footer-brand">
          <span className="site-brand-mark" aria-hidden="true">
            TC
          </span>

          <strong>TASTE CRAFT</strong>
          <p>Good food. Beautiful moments.</p>
        </div>

        <nav className="site-footer-col" aria-label="Explore">
          <h4>Explore</h4>

          <Link to="/menu">Menu</Link>
          <Link to="/orders">My orders</Link>
          <Link to="/cart">Your order</Link>
        </nav>

        <div className="site-footer-col">
          <h4>Visit us</h4>
          <p>📍 Gaza City, Omar El-Mukhtar St.</p>
          <p>🕐 Every day · 11:00 – 23:00</p>
        </div>

        <div className="site-footer-col">
          <h4>Talk to us</h4>

          <a href="tel:+970599123456">
            📞 +970 59 912 3456
          </a>

          <a href="mailto:hello@tastecraft.example">
            ✉️ hello@tastecraft.example
          </a>
        </div>
      </div>

      <p className="site-footer-legal">
        © {new Date().getFullYear()} Taste Craft. All rights
        reserved.
      </p>
    </footer>
  );
}