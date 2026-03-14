import { Link, NavLink, Outlet, Route, Routes } from 'react-router';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudioPage } from '@/pages/StudioPage';
import { PlayerPage } from '@/pages/PlayerPage';
import { Music } from 'lucide-react';

function AppLayout() {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-background via-card to-background px-6 py-3">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-primary hover:opacity-80 transition-opacity"
          >
            <Music className="h-5 w-5" />
            Piano Vision
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm transition-colors ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/studio"
              className={({ isActive }) =>
                `text-sm transition-colors ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`
              }
            >
              Studio
            </NavLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/player/:sheetId" element={<PlayerPage />} />
      </Route>
    </Routes>
  );
}
