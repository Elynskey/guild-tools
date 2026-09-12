import { Tooltip } from './Tooltip';
import { Icon } from './Icon';

interface HelpTooltipProps {
  text: string;
}

/** A small inline (?) glyph that reveals a sentence of explanation on hover/focus -- the one shared building block for onboarding help across every screen. No dismiss-state, no persistence: always available, costs nothing to leave in permanently. */
export function HelpTooltip({ text }: HelpTooltipProps) {
  return (
    <Tooltip label={text} placement="right" wrap>
      <Icon name="circle-help" size={14} style={{ color: 'var(--text-faint)', cursor: 'help', verticalAlign: 'middle' }} />
    </Tooltip>
  );
}
