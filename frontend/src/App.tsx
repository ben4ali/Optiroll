import { HomePage } from '@/pages/HomePage';
import { PlayerPage } from '@/pages/PlayerPage';
import { StudioPage } from '@/pages/StudioPage';
import { Link, NavLink, Outlet, Route, Routes } from 'react-router';

function AppLayout() {
  return (
    <div className="flex flex-col h-screen bg-[#0f1225] text-foreground relative overflow-hidden">
      {/* Ambient background gradients */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-[#3b82f6]/[0.08] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-[#2563eb]/[0.06] blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] h-[400px] w-[400px] rounded-full bg-[#1d4ed8]/[0.05] blur-[80px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-[#141735]/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-sm font-semibold tracking-[0.2em] text-white/90 uppercase hover:text-white transition-colors"
          >
            OPTIROLL
          </Link>
          <nav className="flex items-center gap-6">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm tracking-wide transition-colors ${isActive ? 'text-white font-medium' : 'text-white/40 hover:text-white/70'}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/studio"
              className={({ isActive }) =>
                `text-sm tracking-wide transition-colors ${isActive ? 'text-white font-medium' : 'text-white/40 hover:text-white/70'}`
              }
            >
              Studio
            </NavLink>
          </nav>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/player/:sheetId" element={<PlayerPage />} />
      </Route>
    </Routes>
  );
}
