import { Tooltip } from '../../design-system/Tooltip';

interface RefreshButtonProps {
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * The header's refresh control, styled with the guild crest instead of a generic
 * icon (per guild request) — reuses the design system's .crd-iconbtn classes for
 * consistent sizing/hover/disabled behavior, just with an <img> child instead of
 * the lucide Icon component.
 */
export function RefreshButton({ onRefresh, refreshing }: RefreshButtonProps) {
  return (
    <Tooltip label="Refresh live data">
      <button
        type="button"
        aria-label="Refresh live data"
        title="Refresh live data"
        disabled={refreshing}
        onClick={onRefresh}
        className={`crd-iconbtn crd-iconbtn--sm${refreshing ? ' refresh-spinning' : ''}`}
      >
        <img src="./assets/guild-emblem.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
      </button>
    </Tooltip>
  );
}
