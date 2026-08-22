'use client';

import { useState } from 'react';

const NAV_ITEMS = [
  {
    id: 'proses',
    label: 'Proses Data',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
  },
  {
    id: 'riwayat',
    label: 'Riwayat',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    badge: 'DB',
  },
  {
    id: 'referensi',
    label: 'File Referensi',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

export default function Sidebar({ activePage, onNavigate, collapsed, onToggleCollapse, onLogout }) {
  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-slate-900 text-white z-30
                  flex flex-col transition-all duration-300 ease-in-out
                  ${collapsed ? 'w-[68px]' : 'w-64'}`}
    >
      {/* Brand */}
      <div className={`h-16 flex items-center border-b border-slate-700/50 shrink-0
                       ${collapsed ? 'justify-center px-2' : 'px-5 gap-3'}`}>
        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">Stuffing</p>
            <p className="text-[10px] text-slate-400 truncate">Data Processor</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Menu
          </p>
        )}
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 rounded-lg transition-all duration-150
                       ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                       ${activePage === item.id
                         ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                         : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                       }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && (
              <span className="text-sm font-medium truncate">{item.label}</span>
            )}
            {!collapsed && item.badge && (
              <span className="ml-auto text-[10px] font-bold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-2 py-2 border-t border-slate-700/50">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
          </svg>
          {!collapsed && <span className="text-xs font-medium">Tutup Sidebar</span>}
        </button>
      </div>

      {/* User / Logout */}
      <div className={`px-2 pb-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5
                     text-slate-400 hover:bg-red-600/10 hover:text-red-400 transition-colors
                     ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Keluar' : undefined}
        >
          <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          {!collapsed && <span className="text-sm font-medium">Keluar</span>}
        </button>
      </div>
    </aside>
  );
}
