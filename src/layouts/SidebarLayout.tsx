import React from 'react';

type SidebarLayoutProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export default function SidebarLayout({ sidebar, children }: SidebarLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <div className="w-full md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 shadow-sm z-10 h-screen overflow-y-auto">
        {sidebar}
      </div>
      <div className="flex-1 p-6 md:p-10 overflow-auto">{children}</div>
    </div>
  );
}

