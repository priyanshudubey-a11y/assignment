import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, type QuoteSummary, type QuoteVersion, type VersionSummary } from '../api/client';
import { QuoteNotFound } from '../components/NotFound';
import { POLL_INTERVAL_MS } from '../config';
import { formatDate, formatMoney } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useDocumentTitle } from '../lib/useDocumentTitle';

interface Loaded {
  quote: QuoteSummary;
  viewed: QuoteVersion;
  latest: number;
  versions: VersionSummary[];
}

const versionPath = (id: string, n: number) => `/quotes/${encodeURIComponent(id)}/versions/${n}`;

export function QuoteDetailPage() {
  const { id = '', versionNo } = useParams();
  // Remount per quote/version so the viewed version, banner and polling reset on navigation.
  return <QuoteDetail key={`${id}/${versionNo ?? 'current'}`} id={id} versionNo={versionNo} />;
}

function QuoteDetail({ id, versionNo }: { id: string; versionNo: string | undefined }) {
  const requested = versionNo === undefined ? null : /^[1-9][0-9]{0,8}$/.test(versionNo) ? Number(versionNo) : NaN;

  const { state, reload } = useAsync<Loaded>(async (signal) => {
    if (Number.isNaN(requested)) throw new ApiError(404, 'NOT_FOUND', 'Quote not found.');
    const detail = await api.getQuote(id, signal);
    let viewed = detail.currentVersion;
    if (requested !== null && requested !== detail.currentVersionNo) {
      viewed = (await api.getQuoteVersion(id, requested, signal)).version;
    }
    return { quote: detail.quote, viewed, latest: detail.currentVersionNo, versions: detail.versions };
  }, [id, versionNo ?? '']);

  if (state.status === 'loading') {
    // Never show "Quote not found." while loading.
    return (
      <p role="status" data-testid="detail-loading">
        Loading quote…
      </p>
    );
  }
  if (state.status === 'error') {
    if (state.error.status === 404) return <QuoteNotFound />;
    return (
      <div className="card" role="alert" data-testid="detail-error">
        <p>Could not load this quote. Try again.</p>
        <button type="button" className="btn" onClick={reload} data-testid="detail-retry">
          Retry
        </button>
      </div>
    );
  }
  return <LoadedQuote id={id} initial={state.data} />;
}

function LoadedQuote({ id, initial }: { id: string; initial: Loaded }) {
  const { quote, viewed } = initial;
  const [live, setLive] = useState({ latest: initial.latest, versions: initial.versions });
  useDocumentTitle(`${quote.reference} v${viewed.versionNo}`);

  // FR-07: re-read the quote on refocus and every POLL_INTERVAL_MS; stops when the page is left (unmount).
  useEffect(() => {
    let inFlight = false;
    let stopped = false;
    const ctrl = new AbortController();
    const poll = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const d = await api.getQuote(id, ctrl.signal);
        if (!stopped) {
          setLive((prev) => (d.currentVersionNo >= prev.latest ? { latest: d.currentVersionNo, versions: d.versions } : prev));
        }
      } catch {
        // A failed poll is silent: no banner, no error; the next tick or refocus tries again.
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    const onFocus = () => void poll();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      ctrl.abort();
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id]);

  const isCurrent = viewed.versionNo === live.latest;
  const hasNewer = live.latest > viewed.versionNo;

  return (
    <article aria-labelledby="quote-title" data-testid="quote-detail">
      <p>
        <Link to="/quotes" data-testid="back-to-list">
          Back to quotes
        </Link>
      </p>
      {hasNewer && (
        <div className="banner" role="status" data-testid="newer-version-banner">
          <span>A newer version of this quote is available.</span>{' '}
          <Link to={versionPath(id, live.latest)} data-testid="newer-version-link">
            View version {live.latest}
          </Link>
        </div>
      )}
      <h1 id="quote-title">
        <span data-testid="quote-reference">{quote.reference}</span> <span className="muted">{quote.title}</span>
      </h1>
      <p className="meta">
        <span data-testid="version-number">Version {viewed.versionNo}</span>{' '}
        {isCurrent ? (
          <span className="tag tag-current" data-testid="version-label">
            Current
          </span>
        ) : (
          <span className="tag tag-superseded" data-testid="version-label">
            Superseded
          </span>
        )}
      </p>
      {!isCurrent && (
        <p data-testid="superseded-note">
          This version is read-only.{' '}
          <Link to={versionPath(id, live.latest)} data-testid="current-version-link">
            View the current version (version {live.latest})
          </Link>
        </p>
      )}
      <dl className="facts">
        <div>
          <dt>Status</dt>
          <dd>{quote.status}</dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd>{formatDate(viewed.issuedAt)}</dd>
        </div>
        {viewed.validUntil && (
          <div>
            <dt>Valid until</dt>
            <dd>{formatDate(viewed.validUntil)}</dd>
          </div>
        )}
      </dl>

      {viewed.lineItems.length === 0 ? (
        <p className="card" data-testid="no-line-items">
          No line items.
        </p>
      ) : (
        <table className="table" data-testid="line-items">
          <caption className="sr-only">Line items</caption>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" className="num">Quantity</th>
              <th scope="col" className="num">Unit price</th>
              <th scope="col" className="num">Line total</th>
            </tr>
          </thead>
          <tbody>
            {viewed.lineItems.map((li) => (
              <tr key={li.id} data-testid="line-item">
                <td>{li.description}</td>
                <td className="num">{li.qty}</td>
                <td className="num">{formatMoney(li.unitPrice, viewed.currency)}</td>
                <td className="num">{formatMoney(li.lineTotal, viewed.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="total">
        Total: <strong data-testid="version-total">{formatMoney(viewed.total, viewed.currency)}</strong>
      </p>

      <nav aria-label="Versions" className="versions" data-testid="version-list">
        <h2>Versions</h2>
        <ul>
          {live.versions.map((v) => (
            <li key={v.versionNo}>
              <Link
                to={versionPath(id, v.versionNo)}
                aria-current={v.versionNo === viewed.versionNo ? 'page' : undefined}
                data-testid="version-link"
                data-version-no={v.versionNo}
              >
                Version {v.versionNo}
              </Link>{' '}
              <span className="muted">
                {v.versionNo === live.latest ? 'Current' : 'Superseded'}, issued {formatDate(v.issuedAt)}
              </span>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
