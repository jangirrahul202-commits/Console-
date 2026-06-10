import { useApexStore } from '../store/apex-store';
// @ts-ignore
import logo from '../../public/icons/console-plus-logo.png';
import './Header.css';

export default function Header() {
  const {
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
        <img src={logo} alt="Console+" className="header-logo" />
        <h1 className="header-title">Console+</h1>
      </div>
      
      <div className="header-actions">
        <button
          className={`header-btn ${diffCheckerOpen ? 'header-btn-active' : ''}`}
          onClick={() => (diffCheckerOpen ? closeDiffChecker() : openDiffChecker())}
        >
          Diff Checker
        </button>
        <button
          className="header-btn header-btn-theme"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
