// src/components/Layout.jsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-50 print:block">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto print:p-0">
        <Outlet />
      </main>
    </div>
  );
}
