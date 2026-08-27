import * as LucideIcons from 'lucide-react';
import type { CSSProperties } from 'react';

/** Ported from _ds_bundle.js's Icon.jsx. Swaps the CDN lucide-static mask for the
 * lucide-react package (removes a runtime third-party network dependency). */

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
  title?: string;
}

function kebabToPascal(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

type LucideIconComponent = React.ComponentType<{ size?: number; color?: string; style?: CSSProperties; className?: string }>;

export function Icon({ name, size = 16, color, style, className = '', title }: IconProps) {
  const componentName = kebabToPascal(name);
  const LucideIcon = (LucideIcons as unknown as Record<string, LucideIconComponent>)[componentName];

  if (!LucideIcon) {
    return <span role="presentation" className={className} style={{ width: size, height: size, ...style }} />;
  }

  return (
    <LucideIcon
      size={size}
      color={color ?? 'currentColor'}
      className={className}
      style={style}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    />
  );
}
