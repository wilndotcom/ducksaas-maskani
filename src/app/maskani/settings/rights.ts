export const ADMIN_RIGHT_KEYS = [
  'manage_properties',
  'manage_tenants_leases',
  'manage_invoices',
  'record_payments',
  'manage_maintenance',
  'manage_complaints',
  'view_reports',
  'manage_settings',
] as const

export type AdminRightKey = (typeof ADMIN_RIGHT_KEYS)[number]

export const DEFAULT_ADMIN_RIGHTS: Record<AdminRightKey, boolean> = {
  manage_properties: true,
  manage_tenants_leases: true,
  manage_invoices: true,
  record_payments: true,
  manage_maintenance: true,
  manage_complaints: true,
  view_reports: true,
  manage_settings: false,
}

export const RIGHT_LABELS: Record<AdminRightKey, string> = {
  manage_properties: 'Manage properties & units',
  manage_tenants_leases: 'Manage tenants & leases',
  manage_invoices: 'Manage invoices',
  record_payments: 'Record payments',
  manage_maintenance: 'Manage maintenance',
  manage_complaints: 'Manage complaints',
  view_reports: 'View reports & income',
  manage_settings: 'Manage settings',
}