import type { HTMLAttributes } from 'react';

/** Ported from _ds_bundle.js's Tabs.jsx. */

export interface TabDef {
  value: string;
  label: string;
  count?: number;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  tabs: TabDef[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs = [], value, onChange, className = '', ...rest }: TabsProps) {
  return (
    <div className={`crd-tabs ${className}`} role="tablist" {...rest}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          className="crd-tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count != null && <span className="crd-tab__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
