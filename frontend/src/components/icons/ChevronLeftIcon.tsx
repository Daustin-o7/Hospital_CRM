import type { FC, SVGProps } from 'react';

export const ChevronLeftIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
