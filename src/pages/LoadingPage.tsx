export default function LoadingPage() {
  return (
    <div className="app-shell flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
    </div>
  );
}
