import { useApexStore } from '../store/apex-store';
import './ProblemsPanel.css';

export default function ProblemsPanel() {
  const { problems } = useApexStore();

  return (
    <div className="problems-panel">
      <div className="problems-header">
        <h3>PROBLEMS ({problems.length})</h3>
      </div>
      
      <div className="problems-list">
        {problems.length === 0 ? (
          <div className="problems-empty">
            No problems found
          </div>
        ) : (
          problems.map((problem, index) => (
            <div key={index} className={`problem-item severity-${problem.severity}`}>
              <span className="problem-icon">
                {problem.severity === 'error' ? '🔴' : problem.severity === 'warning' ? '🟡' : 'ℹ️'}
              </span>
              <div className="problem-content">
                <div className="problem-message">{problem.message}</div>
                <div className="problem-location">
                  Line {problem.line}, Column {problem.column}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
