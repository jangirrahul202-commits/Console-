import { useApexStore } from '../store/apex-store';

export default function DebugLogViewer() {
  useApexStore();

  return (
    <div style={{ padding: '20px', color: '#fff' }}>
      <h2>Debug Log Viewer</h2>
      <p>Feature coming soon...</p>
    </div>
  );
}
