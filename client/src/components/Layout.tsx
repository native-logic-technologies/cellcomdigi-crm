import {
  LayoutDashboard, Users, Building2, Banknote, Inbox,
  ShoppingCart, FileText, Network, Menu, X, Bell, Moon, Sun,
  Settings, LogOut, ChevronLeft, ChevronRight, Wand2, TrendingUp,
  Share2, Brain
} from 'lucide-react';
import { useState } from 'react';
import { useConnectionStatus } from '../spacetime/hooks';
import {
  Navbar, NavbarContent, NavbarItem, Button, Avatar,
  Input, Tooltip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
} from '@nextui-org/react';

type Page = 'dashboard' | 'contacts' | 'companies' | 'deals' | 'inbox' | 'products' | 'invoices' | 'graph' | 'automations' | 'analytics' | 'social' | 'knowledgebase';

interface NavSection {
  label: string;
  items: { id: Page; label: string; icon: React.ElementType }[];
}

const navSections: NavSection[] = [
  {
    label: 'Sales',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'deals', label: 'Deals', icon: Banknote },
      { id: 'contacts', label: 'Contacts', icon: Users },
      { id: 'companies', label: 'Companies', icon: Building2 },
      { id: 'automations', label: 'Automations', icon: Wand2 },
      { id: 'analytics', label: 'Analytics', icon: TrendingUp },
      { id: 'social', label: 'Social Planner', icon: Share2 },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'invoices', label: 'Invoices', icon: FileText },
      { id: 'products', label: 'Products', icon: ShoppingCart },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'inbox', label: 'Inbox', icon: Inbox },
      { id: 'graph', label: 'Knowledge Graph', icon: Network },
      { id: 'knowledgebase', label: 'Knowledge Base', icon: Brain },
    ],
  },
];

const pageTitles: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your business' },
  contacts: { title: 'Contacts', subtitle: 'Manage your leads and customers' },
  companies: { title: 'Companies', subtitle: 'Manage your business accounts' },
  deals: { title: 'Deals', subtitle: 'Track your sales pipeline' },
  inbox: { title: 'Inbox', subtitle: 'Unified conversations across channels' },
  products: { title: 'Products', subtitle: 'Manage your product catalog' },
  invoices: { title: 'Invoices', subtitle: 'Billing and LHDN e-invoicing' },
  graph: { title: 'Knowledge Graph', subtitle: 'Visualize relationships across your data' },
  automations: { title: 'Automations', subtitle: 'AI-powered workflow automation' },
  analytics: { title: 'Analytics', subtitle: 'Pipeline performance and conversion metrics' },
  social: { title: 'Social Planner', subtitle: 'Plan, generate, and publish social content' },
  knowledgebase: { title: 'Knowledge Base', subtitle: 'Documents, memories, and intelligence containers' },
};

export default function Layout({ page, setPage, children, user, onLogout }: {
  page: Page;
  setPage: (p: Page) => void;
  children: React.ReactNode;
  user: { name: string; email: string } | null;
  onLogout: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const connected = useConnectionStatus();

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]';

  return (
    <div className={`min-h-screen flex bg-slate-50 ${darkMode ? 'dark' : ''}`}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-slate-200
          flex flex-col transform transition-all duration-300 ease-in-out
          ${sidebarWidth}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm shadow-brand-200">
            <span className="text-white font-bold text-sm font-outfit">CC</span>
          </div>
          {!collapsed && (
            <span className="ml-3 font-semibold text-slate-800 font-outfit text-lg tracking-tight">
              CellCom
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden lg:flex p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = page === item.id;
                  return (
                    <Tooltip
                      key={item.id}
                      content={item.label}
                      placement="right"
                      isDisabled={!collapsed}
                      delay={300}
                    >
                      <button
                        onClick={() => { setPage(item.id); setMobileOpen(false); }}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl
                          transition-all duration-200 relative
                          ${active
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                          }
                          ${collapsed ? 'justify-center' : ''}
                        `}
                      >
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand-600" />
                        )}
                        <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-slate-100">
          <div className={`flex items-center gap-3 px-2 py-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
            <Avatar
              size="sm"
              name={user?.name ?? 'Guest'}
              className="bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 truncate">{user?.name ?? 'Guest'}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className="text-[11px] text-slate-400">{connected ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <Navbar isBordered maxWidth="full" className="bg-white/80 backdrop-blur-xl h-16">
          <NavbarContent justify="start" className="gap-4">
            <Button
              isIconOnly
              variant="light"
              className="lg:hidden text-slate-500"
              onPress={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <NavbarItem className="hidden sm:flex">
              <Input
                classNames={{
                  base: 'w-72',
                  inputWrapper: 'h-9 bg-slate-100 border-0 shadow-none',
                  input: 'text-sm placeholder:text-slate-400',
                }}
                placeholder="Search contacts, deals..."
                size="sm"
              />
            </NavbarItem>
          </NavbarContent>
          <NavbarContent justify="end" className="gap-2">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="text-slate-500"
              onPress={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button isIconOnly variant="light" size="sm" className="text-slate-500 relative">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Notifications">
                <DropdownItem key="msg">3 new messages from leads</DropdownItem>
                <DropdownItem key="deal">Deal "TechVenture CRM" moved to Proposal</DropdownItem>
                <DropdownItem key="inv">Invoice INV-001 is overdue</DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Avatar
                  size="sm"
                  name={user?.name ?? 'Guest'}
                  className="bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs cursor-pointer"
                />
              </DropdownTrigger>
              <DropdownMenu aria-label="User menu">
                <DropdownItem key="settings" startContent={<Settings className="w-4 h-4" />}>Settings</DropdownItem>
                <DropdownItem key="logout" startContent={<LogOut className="w-4 h-4" />} className="text-rose-600" onPress={onLogout}>
                  Log out
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarContent>
        </Navbar>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export type { Page };
export { pageTitles };
