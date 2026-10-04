import type { FC, SVGProps } from 'react';

export const TruckIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h4a1 1 0 001-1v-4a1 1 0 00-1-1h-4m-6 0a1 1 0 011 1v4a1 1 0 01-1 1h4" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17h4a1 1 0 001-1v-4a1 1 0 00-1-1H5" />
  </svg>
);
