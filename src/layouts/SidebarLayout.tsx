import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { PanelLeft, X } from 'lucide-react';

type SidebarLayoutProps = {
  sidebar: ReactNode;
  children: ReactNode;
  mainRef?: RefObject<HTMLDivElement | null>;
  mobileSidebarCollapsed?: boolean;
};

export default function SidebarLayout({
  sidebar,
  children,
  mainRef,
  mobileSidebarCollapsed = false,
}: SidebarLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const showSidebarOnlyOnMobile = !mobileSidebarCollapsed;

  useEffect(() => {
    if (showSidebarOnlyOnMobile) {
      setIsMobileSidebarOpen(false);
    }
  }, [showSidebarOnlyOnMobile]);

  const mobileSidebarClass = showSidebarOnlyOnMobile
    ? 'w-full h-screen overflow-y-auto'
    : `fixed top-0 left-0 h-screen w-[88vw] max-w-sm overflow-y-auto
       transition-transform duration-200 ease-out
       ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
       shadow-xl`;

  return (
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden">
      {!showSidebarOnlyOnMobile && isMobileSidebarOpen && (
        <button
          id="print-sidebar-overlay"
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 z-20 md:hidden cursor-pointer"
        />
      )}

      <div
        id="print-sidebar"
        className={`bg-white border-r border-slate-200 p-6 flex flex-col gap-6 z-30 shrink-0 md:w-80 md:h-screen md:overflow-y-auto md:shadow-sm md:relative md:translate-x-0 ${mobileSidebarClass}`}
      >
        {!showSidebarOnlyOnMobile && (
          <button
            id="print-sidebar-close-mobile"
            type="button"
            aria-label="Close sidebar"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden absolute top-4 right-4 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {sidebar}
      </div>

      <div
        id="print-main"
        ref={mainRef}
        className={`flex-1 p-6 md:p-10 overflow-y-auto ${showSidebarOnlyOnMobile ? 'hidden md:block' : 'block'}`}
      >
        {children}
      </div>

      {!showSidebarOnlyOnMobile && (
        <button
          id="print-sidebar-open-mobile"
          type="button"
          aria-label="Open sidebar"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden fixed bottom-5 right-5 z-20 inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
