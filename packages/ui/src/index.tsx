import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export const tokens = {
  colorBgApp: '#F6F8FB',
  colorBgSurface: '#FFFFFF',
  colorBgSubtle: '#EEF3F8',
  colorTextPrimary: '#172033',
  colorTextSecondary: '#4D5B70',
  colorTextMuted: '#6F7D91',
  colorBorder: '#D8E0EA',
  colorPrimary: '#1F5EFF',
  colorPrimaryHover: '#1749C7',
  colorSuccess: '#168A4A',
  colorSuccessBg: '#E7F6EE',
  colorWarning: '#B7791F',
  colorWarningBg: '#FFF4D6',
  colorDanger: '#C0362C',
  colorDangerBg: '#FCE8E6',
  colorInfo: '#2563A8',
  colorInfoBg: '#E7F0FB',
};

export function Button({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="pp-button" {...props}>{children}</button>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="pp-input" {...props} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="pp-select" {...props}>{children}</select>;
}

export function StatusBadge({ children, tone = 'info' }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={`pp-status-badge pp-status-badge--${tone}`}>{children}</span>;
}

export function Table({ children }: { children: ReactNode }) {
  return <div className="pp-table-wrapper"><table className="pp-table">{children}</table></div>;
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return <div className="pp-state" aria-live="polite">{label}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <section className="pp-state"><strong>{title}</strong><span>{description}</span></section>;
}

export function ErrorState({ title = 'Something went wrong', description }: { title?: string; description: string }) {
  return <section className="pp-state pp-state--error" role="alert"><strong>{title}</strong><span>{description}</span></section>;
}

export function PermissionDenied() {
  return <section className="pp-state pp-state--error" role="alert"><strong>Permission denied</strong><span>You do not have permission to view this information.</span></section>;
}
