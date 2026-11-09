import { Link } from 'react-router-dom';

import HomeFeatured from '../components/HomeFeatured.jsx';
import HomeReviews from '../components/HomeReviews.jsx';
import SiteFooter from '../components/SiteFooter.jsx';

const steps = [
  {
    number: '01',
    title: 'Find your favourite.',
    description:
      'Explore our menu and discover something worth looking forward to.',
  },
  {
    number: '02',
    title: 'Make it your moment.',
    description:
      'Sign in, choose your dishes, and customize every detail.',
  },
  {
    number: '03',
    title: 'Track it to your table.',
    description:
      'Follow your order live, from the kitchen to your door.',
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="site-container hero-content">
          <p className="hero-eyebrow">WELCOME TO TASTE CRAFT</p>

          <h1 id="hero-title">
            Good taste.
            <br />
            <em>Beautiful moments.</em>
          </h1>

          <p className="hero-description">
            Find your next favourite. A thoughtful menu, a little
            indulgence, and something delicious to take with you.
          </p>

          <div className="hero-actions">
            <Link to="/menu" className="site-button button-gold">
              Explore the menu
              <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <p className="hero-footnote">
            ORDER ONLINE · PICK UP AT TASTE CRAFT
          </p>
        </div>
      </section>

      <HomeFeatured />

      <section
        className="experience-section site-container"
        aria-labelledby="experience-title"
      >
        <div className="section-heading">
          <p className="eyebrow">SIMPLE, FROM THE FIRST BITE</p>

          <h2 id="experience-title">
            Your next good moment starts here.
          </h2>
        </div>

        <div className="experience-grid">
          {steps.map((step) => (
            <article className="experience-card" key={step.number}>
              <span className="step-number" aria-hidden="true">
                {step.number}
              </span>

              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <HomeReviews />

      <SiteFooter />
    </main>
  );
}