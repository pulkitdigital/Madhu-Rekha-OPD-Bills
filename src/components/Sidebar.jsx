// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: null},
  { to: '/new-bill', label: '+ New O.P.D. Bill ', icon: null },
  { to: '/all-bills', label: 'All Bills', icon: null },
  { to: '/payment-history', label: 'All Payments', icon: null },
];

export default function Sidebar() {
  return (
    <aside className="w-52 min-h-screen bg-white border-r border-slate-200 text-slate-700 flex flex-col print:hidden">
      {/* Header */}
      <div className="px-5 py-5 border-b border-slate-100">
        <p className="text-sm font-bold text-slate-900 leading-tight">Madhurekha Eye Care Centre</p>
        <p className="text-xs text-slate-400 mt-0.5">OPD Billing System</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `block px-5 py-2.5 text-sm transition-colors m-2 ${
                isActive
                  ? 'bg-slate-900 text-white font-semibold rounded-lg'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}