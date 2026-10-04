import type { FC, SVGProps } from 'react';

export const ActivityIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5m14 0v-6a2 2 0 00-2-2h-3m14 0V9a2 2 0 012-2h3m-12 14a2 2 0 01-2-2v-6a2 2 0 012-2h3m-12 0h18" />
  </svg>
);
