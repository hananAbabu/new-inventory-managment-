import type { IconName } from '@/components/icon';
import type { Role } from './types';

export interface PageDef {
  path: string;
  title: string;
  roles: Role[];
}

/** Route table — the Next.js equivalent of the original PAGES map. */
export const PAGES: PageDef[] = [
  { path: '/dashboard', title: 'Dashboard', roles: ['admin', 'shopkeeper', 'cashier'] },
  { path: '/pos', title: 'Point of Sale', roles: ['admin', 'cashier'] },
  { path: '/products', title: 'Products', roles: ['admin', 'shopkeeper'] },
  { path: '/categories', title: 'Categories', roles: ['admin'] },
  { path: '/inventory', title: 'Inventory', roles: ['admin', 'shopkeeper'] },
  { path: '/low-stock', title: 'Low Stock Monitor', roles: ['admin', 'shopkeeper'] },
  { path: '/sales', title: 'Sales History', roles: ['admin'] },
  { path: '/my-sales', title: 'My Sales', roles: ['cashier'] },
  { path: '/suppliers', title: 'Suppliers', roles: ['admin', 'shopkeeper'] },
  { path: '/purchases', title: 'Purchases', roles: ['admin', 'shopkeeper'] },
  { path: '/reports', title: 'Reports', roles: ['admin', 'shopkeeper'] },
  { path: '/users', title: 'Users & Roles', roles: ['admin'] },
  { path: '/audit', title: 'Audit Log', roles: ['admin'] },
  { path: '/settings', title: 'System Settings', roles: ['admin'] },
];

export function pageFor(path: string): PageDef | undefined {
  return PAGES.find((p) => p.path === path);
}

export function can(role: Role | undefined, path: string): boolean {
  const page = pageFor(path);
  return !!role && !!page && page.roles.includes(role);
}

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export function navFor(role: Role): NavGroup[] {
  if (role === 'admin')
    return [
      {
        group: 'Overview',
        items: [
          { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { path: '/pos', label: 'Point of Sale', icon: 'pos' },
        ],
      },
      {
        group: 'Catalog',
        items: [
          { path: '/products', label: 'Products', icon: 'tag' },
          { path: '/categories', label: 'Categories', icon: 'folder' },
        ],
      },
      {
        group: 'Inventory',
        items: [
          { path: '/inventory', label: 'Inventory', icon: 'cube' },
          { path: '/low-stock', label: 'Low Stock', icon: 'alert' },
          { path: '/suppliers', label: 'Suppliers', icon: 'truck' },
          { path: '/purchases', label: 'Purchases', icon: 'inbox' },
        ],
      },
      {
        group: 'Sales',
        items: [
          { path: '/sales', label: 'Sales History', icon: 'receipt' },
          { path: '/reports', label: 'Reports', icon: 'chart' },
        ],
      },
      {
        group: 'System',
        items: [
          { path: '/users', label: 'Users & Roles', icon: 'users' },
          { path: '/audit', label: 'Audit Log', icon: 'shield' },
          { path: '/settings', label: 'Settings', icon: 'sliders' },
        ],
      },
    ];

  if (role === 'shopkeeper')
    return [
      { group: 'Overview', items: [{ path: '/dashboard', label: 'Dashboard', icon: 'dashboard' }] },
      { group: 'Catalog', items: [{ path: '/products', label: 'Products', icon: 'tag' }] },
      {
        group: 'Inventory',
        items: [
          { path: '/inventory', label: 'Inventory', icon: 'cube' },
          { path: '/low-stock', label: 'Low Stock', icon: 'alert' },
          { path: '/suppliers', label: 'Suppliers', icon: 'truck' },
          { path: '/purchases', label: 'Purchases', icon: 'inbox' },
        ],
      },
      { group: 'Insights', items: [{ path: '/reports', label: 'Reports', icon: 'chart' }] },
    ];

  return [
    {
      group: 'Register',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { path: '/pos', label: 'New Sale', icon: 'pos' },
        { path: '/my-sales', label: 'My Sales', icon: 'receipt' },
      ],
    },
  ];
}
