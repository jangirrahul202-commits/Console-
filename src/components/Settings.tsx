import { useApexStore } from '../store/apex-store';
import type { AppTheme } from '../types';
import './Settings.css';

export default function Settings() {
  const { theme, setTheme, closeSettings } = useApexStore();

  const selectTheme = (next: AppTheme) => {
    setTheme(next);
  };

  return (
    <div className="settings">
      <h2 className="settings-title">Settings</h2>

      <section className="settings-section">
        <h3>Appearance</h3>
        <div className="theme-options">
          <button
            type="button"
            className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => selectTheme('dark')}
          >
            <span className="theme-option-icon">🌙</span>
            <span className="theme-option-label">Dark</span>
          </button>
          <button
            type="button"
            className={`theme-option ${theme === 'light' ? 'active' : ''}`}
            onClick={() => selectTheme('light')}
          >
            <span className="theme-option-icon">☀️</span>
            <span className="theme-option-label">Light</span>
          </button>
        </div>
      </section>

      <button type="button" className="settings-close" onClick={closeSettings}>
        Close
      </button>
    </div>
  );
}
