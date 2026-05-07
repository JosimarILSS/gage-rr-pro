export default function LoadingPage() {
  return (
    <div className="app-loading-interface" role="status" aria-label="Cargando interfaz">
      <div className="app-loading-frame">
        <div className="app-loading-topbar">
          <div className="app-loading-skeleton app-loading-title-block" />
          <div className="app-loading-skeleton app-loading-logo-block" />
          <div className="app-loading-actions">
            <div className="app-loading-skeleton app-loading-action" />
            <div className="app-loading-skeleton app-loading-action is-short" />
            <div className="app-loading-skeleton app-loading-action" />
          </div>
        </div>

        <main className="app-loading-content">
          <section className="app-loading-main">
            <div className="app-loading-skeleton app-loading-heading" />
            <div className="app-loading-skeleton app-loading-subheading" />
            <div className="app-loading-card-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="app-loading-card">
                  <div className="app-loading-skeleton app-loading-icon" />
                  <div className="app-loading-skeleton app-loading-card-title" />
                  <div className="app-loading-skeleton app-loading-card-line" />
                  <div className="app-loading-skeleton app-loading-card-line is-medium" />
                  <div className="app-loading-skeleton app-loading-card-link" />
                </div>
              ))}
            </div>
          </section>

          <aside className="app-loading-profile">
            <div className="app-loading-profile-row">
              <div className="app-loading-skeleton app-loading-avatar" />
              <div className="app-loading-profile-copy">
                <div className="app-loading-skeleton app-loading-profile-line" />
                <div className="app-loading-skeleton app-loading-profile-line is-strong" />
              </div>
            </div>
            <div className="app-loading-divider" />
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="app-loading-detail-row">
                <div className="app-loading-skeleton app-loading-detail-icon" />
                <div className="app-loading-skeleton app-loading-detail-line" />
              </div>
            ))}
          </aside>
        </main>
      </div>
    </div>
  );
}
