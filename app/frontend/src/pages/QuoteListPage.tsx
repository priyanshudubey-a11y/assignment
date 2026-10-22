import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { LIST_PAGE_SIZE } from '../config';
import { formatDate, formatMoney } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useDocumentTitle } from '../lib/useDocumentTitle';

function parsePage(raw: string | null): number {
  return raw && /^[1-9][0-9]{0,6}$/.test(raw) ? Number(raw) : 1;
}

export function QuoteListPage() {
  useDocumentTitle('Quotes');
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const page = parsePage(params.get('page'));
  const { state, reload } = useAsync((signal) => api.listQuotes({ page, pageSize: LIST_PAGE_SIZE }, signal), [page]);

  // A malformed ?page= (0, abc, -1) is normalised to the list start.
  useEffect(() => {
    const raw = params.get('page');
    if (raw !== null && String(page) !== raw) setParams({}, { replace: true });
  }, [page, params, setParams]);

  // Q-P5: a page beyond the last one, when quotes exist, moves to the last page.
  const data = state.status === 'success' ? state.data : null;
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && data.totalPages > 0 && page > data.totalPages) {
      setParams({ page: String(data.totalPages) }, { replace: true });
    }
  }, [data, page, setParams]);

  const goto = (p: number) => setParams(p <= 1 ? {} : { page: String(p) });

  return (
    <section aria-labelledby="list-title">
      <h1 id="list-title">Quotes</h1>
      {state.status === 'loading' && (
        <p role="status" data-testid="list-loading">
          Loading quotes…
        </p>
      )}
      {state.status === 'error' && (
        <div className="card" role="alert" data-testid="list-error">
          <p>Could not load quotes. Try again.</p>
          <button type="button" className="btn" onClick={reload} data-testid="list-retry">
            Retry
          </button>
        </div>
      )}
      {data && data.total === 0 && (
        <div className="card" data-testid="list-empty">
          <p>You have no quotes yet.</p>
        </div>
      )}
      {data && data.items.length > 0 && (
        <>
          <table className="table" data-testid="quote-list">
            <caption className="sr-only">Quotes, page {data.page} of {data.totalPages}</caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">Version</th>
                <th scope="col" className="num">Total</th>
                <th scope="col">Issued</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((q) => (
                <tr
                  key={q.id}
                  className="clickable"
                  data-testid="quote-row"
                  data-quote-id={q.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a')) return;
                    navigate(`/quotes/${encodeURIComponent(q.id)}`);
                  }}
                >
                  <td>
                    <Link to={`/quotes/${encodeURIComponent(q.id)}`} data-testid="quote-row-link">
                      {q.reference}
                    </Link>
                  </td>
                  <td>{q.title}</td>
                  <td>{q.status}</td>
                  <td className="num">v{q.currentVersionNo}</td>
                  <td className="num">{formatMoney(q.total, q.currency)}</td>
                  <td>{formatDate(q.issuedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.totalPages > 1 && (
            <nav className="pagination" aria-label="Pagination" data-testid="pagination">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={data.page <= 1}
                onClick={() => goto(data.page - 1)}
                data-testid="page-prev"
              >
                Previous
              </button>
              <span aria-live="polite" data-testid="page-indicator">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={data.page >= data.totalPages}
                onClick={() => goto(data.page + 1)}
                data-testid="page-next"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
