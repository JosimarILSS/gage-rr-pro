import React from 'react';

type SidebarLayoutProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  mainRef?: React.RefObject<HTMLDivElement | null>;
};

export default function SidebarLayout({ sidebar, children, mainRef }: SidebarLayoutProps) {
  return (
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden">
      <div id="print-sidebar" className="w-full md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 shadow-sm z-10 h-screen overflow-y-auto shrink-0">
        {sidebar}
      </div>
      <div id="print-main" ref={mainRef} className="flex-1 p-6 md:p-10 overflow-y-auto">{children}</div>
    </div>
  );
}

