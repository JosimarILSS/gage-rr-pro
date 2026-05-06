import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { PanelLeft, X } from 'lucide-react';

type SidebarLayoutProps = {
  sidebar: ReactNode;
  children: ReactNode;
  navbar?: ReactNode;
  mainRef?: RefObject<HTMLDivElement | null>;
  mobileSidebarCollapsed?: boolean;
  sidebarClassName?: string;
  mainClassName?: string;
};

export default function SidebarLayout({
  sidebar,
  children,
  navbar,
  mainRef,
  mobileSidebarCollapsed = false,
  sidebarClassName = '',
  mainClassName = '',
}: SidebarLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const showSidebarOnlyOnMobile = !mobileSidebarCollapsed;

  useEffect(() => {
    if (showSidebarOnlyOnMobile) {
      setIsMobileSidebarOpen(false);
    }
  }, [showSidebarOnlyOnMobile]);

  const mobileSidebarClass = showSidebarOnlyOnMobile
    ? 'w-full h-full overflow-y-auto'
    : `fixed top-0 left-0 h-screen w-[88vw] max-w-sm overflow-y-auto
       transition-transform duration-200 ease-out
       ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
       shadow-xl`;

  return (
    <div className="h-screen app-shell flex flex-col overflow-hidden">
      {navbar}

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
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
        className={`app-sidebar p-6 flex flex-col gap-6 z-30 shrink-0 md:w-80 md:h-full md:overflow-y-auto md:relative md:translate-x-0 ${mobileSidebarClass} ${sidebarClassName}`}
      >
        {!showSidebarOnlyOnMobile && (
          <button
            id="print-sidebar-close-mobile"
            type="button"
            aria-label="Close sidebar"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="app-mobile-only absolute top-3 right-3 app-button app-button-secondary app-button-round app-button-icon"
          >
            <X className="w-6 h-6" />
          </button>
        )}
        {sidebar}
      </div>

      <div
        id="print-main"
        ref={mainRef}
        className={`flex-1 p-6 md:p-10 overflow-y-auto ${showSidebarOnlyOnMobile ? 'hidden md:block' : 'block'} ${mainClassName}`}
      >
        {children}
      </div>

      {!showSidebarOnlyOnMobile && (
        <button
          id="print-sidebar-open-mobile"
          type="button"
          aria-label="Open sidebar"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="app-mobile-only fixed bottom-5 right-5 z-20 app-button app-button-primary app-button-round w-14 h-14 shadow-lg"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}
      </div>
    </div>
  );
}
