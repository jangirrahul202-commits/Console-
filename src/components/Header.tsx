import { useApexStore } from '../store/apex-store';
// @ts-ignore
import logoAnimated from '../../public/icons/logo-animated.svg';
import './Header.css';

export default function Header() {
  const {
    openDebugLogViewer,
    openSettings,
    openSoqlBuilder,
    openDiffChecker,
    closeDiffChecker,
    diffCheckerOpen,
    theme,
    setTheme
  } = useApexStore();

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <header className="header">
      <div className="header-left">
        <img src={logoAnimated} alt="Console+" className="header-logo" />
        <h1 className="header-title">Console+</h1>
      </div>
      
      <div className="header-actions">
        <button className="header-btn" onClick={() => openSoqlBuilder()}>
          SOQL Query
        </button>
        <button
          className={`header-btn ${diffCheckerOpen ? 'header-btn-active' : ''}`}
          onClick={() => (diffCheckerOpen ? closeDiffChecker() : openDiffChecker())}
        >
          Diff Checker
        </button>
        <button className="header-btn" onClick={() => openDebugLogViewer()}>
          Debug Logs
        </button>
        <button
          className="header-btn header-btn-theme"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="header-btn" onClick={() => openSettings()}>
          ⚙️ Settings
        </button>
      </div>
    </header>
  );
}
