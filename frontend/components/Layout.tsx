import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Moon, Sun, Menu, ChevronLeft } from 'lucide-react';
import { useTheme } from './ThemeProvider';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  FlaskConical,
  Beaker,
  Radio,
  LineChart,
  Briefcase,
  Shield,
  MessageSquare,
  Settings as SettingsIcon,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Ticker Intelligence', href: '/ticker-intelligence', icon: TrendingUp },
  { name: 'Factor Explorer', href: '/factor-explorer', icon: Activity },
  { name: 'Model Lab', href: '/model-lab', icon: FlaskConical },
  { name: 'Experiments', href: '/experiments', icon: Beaker },
  { name: 'Signal Diagnostics', href: '/signal-diagnostics', icon: Radio },
  { name: 'Strategy Backtest', href: '/strategy-backtest', icon: LineChart },
  { name: 'Portfolio Lab', href: '/portfolio-lab', icon: Briefcase },
  { name: 'Risk & Performance', href: '/risk-performance', icon: Shield },
  { name: 'Sentiment', href: '/sentiment', icon: MessageSquare },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    console.log('🔘 Toggle button clicked - Current theme:', theme, '→ New theme:', newTheme);
    setTheme(newTheme);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-card border-r border-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}>
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {!collapsed && <h1 className="text-xl font-bold text-foreground">QuantSight</h1>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={toggleTheme}
            className={cn(
              "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Toggle theme" : undefined}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {!collapsed && <span>Toggle Theme</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn(
        "transition-all duration-300 min-h-screen",
        collapsed ? "pl-16" : "pl-64"
      )}>
        <div className="container mx-auto p-6 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
