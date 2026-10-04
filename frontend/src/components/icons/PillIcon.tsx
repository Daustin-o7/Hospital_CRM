import type { FC, SVGProps } from 'react';

export const PillIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.75 3a6 6 0 010 12M5 12h14M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2H5z" />
  </svg>
);
