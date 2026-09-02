import { Tabs, type TabDef } from '../../design-system/Tabs';
import { Input } from '../../design-system/Input';
import { Switch } from '../../design-system/Switch';
import { Button } from '../../design-system/Button';

interface ControlBarProps {
  roleTabs: TabDef[];
  roleValue: string;
  setRole: (v: string) => void;
  query: string;
  setQuery: (v: string) => void;
  sortWorst: boolean;
  setSortWorst: (v: boolean) => void;
  onOpenDpsCheckSettings: () => void;
}

export function ControlBar({ roleTabs, roleValue, setRole, query, setQuery, sortWorst, setSortWorst, onOpenDpsCheckSettings }: ControlBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <Tabs tabs={roleTabs} value={roleValue} onChange={setRole} />
      <div style={{ flex: 1 }} />
      <Button variant="secondary" size="sm" iconLeft="sliders-horizontal" onClick={onOpenDpsCheckSettings}>
        DPS check settings
      </Button>
      <div style={{ width: 240 }}>
        <Input placeholder="Find a raider" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Switch label="Needs support first" checked={sortWorst} onChange={setSortWorst} />
    </div>
  );
}
