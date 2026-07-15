import type { ReactNode } from 'react';
export const tokens = { colorBgApp:'#F6F8FB', colorTextPrimary:'#172033', colorPrimary:'#1F5EFF' };
export function Button({children}:{children:ReactNode}) { return <button className="pp-button">{children}</button>; }
export function StatusBadge({children}:{children:ReactNode}) { return <span className="pp-status-badge">{children}</span>; }
export function PermissionDenied() { return <section role="alert"><h2>Permission denied</h2><p>You do not have permission to view this information.</p></section>; }
