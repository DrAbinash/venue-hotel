/**
 * Role-based access for the staff ERP. Shared by the API guards and the
 * sidebar, so a module a user cannot open is also a module their requests
 * cannot touch.
 */

export const ERP_MODULES = [
  'dashboard',
  'frontdesk',
  'reservations',
  'housekeeping',
  'pos',
  'inventory',
  'hr',
  'maintenance',
  'banquets',
  'finance',
  'guests',
  'reports',
  'settings',
  'users',
  'audit',
] as const;

export type ErpModule = (typeof ERP_MODULES)[number];

export const MODULE_LABELS: Record<ErpModule, string> = {
  dashboard: 'Dashboard',
  frontdesk: 'Front Desk',
  reservations: 'Reservations',
  housekeeping: 'Housekeeping',
  pos: 'Restaurant POS',
  inventory: 'Stores & Purchase',
  hr: 'HR & Payroll',
  maintenance: 'Maintenance',
  banquets: 'Banquets & Events',
  finance: 'Finance & GST',
  guests: 'Guest CRM',
  reports: 'Reports',
  settings: 'ERP Settings',
  users: 'Staff Users',
  audit: 'Audit Trail',
};

export const ERP_ROLES = [
  'ADMIN',
  'MANAGER',
  'FRONTDESK',
  'HOUSEKEEPING',
  'FNB',
  'STORES',
  'ACCOUNTS',
  'HR',
  'MAINTENANCE',
] as const;

export type ErpRole = (typeof ERP_ROLES)[number];

export const ROLE_LABELS: Record<ErpRole, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'General Manager',
  FRONTDESK: 'Front Office',
  HOUSEKEEPING: 'Housekeeping',
  FNB: 'F&B Service',
  STORES: 'Stores / Purchase',
  ACCOUNTS: 'Accounts',
  HR: 'HR',
  MAINTENANCE: 'Engineering',
};

/** What each role can open out of the box. Extra modules can be granted per user. */
export const ROLE_PRESETS: Record<ErpRole, ErpModule[]> = {
  ADMIN: [...ERP_MODULES],
  MANAGER: [
    'dashboard', 'frontdesk', 'reservations', 'housekeeping', 'pos', 'inventory', 'hr',
    'maintenance', 'banquets', 'finance', 'guests', 'reports', 'settings', 'audit',
  ],
  FRONTDESK: ['dashboard', 'frontdesk', 'reservations', 'guests', 'pos', 'banquets'],
  HOUSEKEEPING: ['dashboard', 'housekeeping', 'maintenance'],
  FNB: ['dashboard', 'pos'],
  STORES: ['dashboard', 'inventory'],
  ACCOUNTS: ['dashboard', 'finance', 'reports', 'banquets', 'audit'],
  HR: ['dashboard', 'hr'],
  MAINTENANCE: ['dashboard', 'maintenance'],
};

/** Effective module set for a user: role preset plus any per-user grants. */
export function effectiveModules(role: string, extraPermissions: string[]): ErpModule[] {
  const preset = ROLE_PRESETS[role as ErpRole] ?? ['dashboard'];
  const extras = extraPermissions.filter((m): m is ErpModule =>
    (ERP_MODULES as readonly string[]).includes(m),
  );
  return [...new Set([...preset, ...extras])];
}

export function canAccess(modules: string[], module: ErpModule): boolean {
  return modules.includes(module);
}
