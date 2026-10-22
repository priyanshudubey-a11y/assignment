import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/** FE-10: identical for unknown, malformed and other-organisation ids. */
export function QuoteNotFound() {
  useDocumentTitle('Quote not found');
  return (
    <section className="card" data-testid="not-found">
      <h1>Quote not found.</h1>
      <p>
        <Link to="/quotes" data-testid="back-to-list">
          Back to quotes
        </Link>
      </p>
    </section>
  );
}

export function PageNotFound() {
  useDocumentTitle('Page not found');
  return (
    <section className="card" data-testid="page-not-found">
      <h1>Page not found.</h1>
      <p>
        <Link to="/quotes">Back to quotes</Link>
      </p>
    </section>
  );
}
