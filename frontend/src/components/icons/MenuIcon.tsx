import type { FC, SVGProps } from 'react';

export const MenuIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
