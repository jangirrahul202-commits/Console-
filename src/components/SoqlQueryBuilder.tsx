import { useApexStore } from '../store/apex-store';

export default function SoqlQueryBuilder() {
  const { closeSoqlBuilder } = useApexStore();

  return (
    <div style={{ padding: '20px', color: '#fff' }}>
      <h2>SOQL Query Builder</h2>
      <p>Feature coming soon...</p>
      <button onClick={closeSoqlBuilder}>Close</button>
    </div>
  );
}
