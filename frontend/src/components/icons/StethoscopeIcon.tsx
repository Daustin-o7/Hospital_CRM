import type { FC, SVGProps } from 'react';

export const StethoscopeIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5V3M21 12a9 9 0 100-18 9 9 0 000 18z" />
  </svg>
);
