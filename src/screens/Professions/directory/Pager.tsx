import { Button } from '../../../design-system/Button';

interface PagerProps {
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pager({ page, pages, onPrev, onNext }: PagerProps) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', paddingTop: 4 }}>
      <Button variant="secondary" size="sm" iconLeft="chevron-left" onClick={onPrev} disabled={page <= 1}>
        Prev
      </Button>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
        Page {page} of {pages}
      </span>
      <Button variant="secondary" size="sm" iconRight="chevron-right" onClick={onNext} disabled={page >= pages}>
        Next
      </Button>
    </div>
  );
}
