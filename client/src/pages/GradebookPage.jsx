import { useParams, Link } from 'react-router-dom';
import GradebookTable from '../components/GradebookTable.jsx';

export default function GradebookPage() {
  const { id } = useParams();
  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', padding: '0 16px' }}>
      <Link to={`/courses/${id}`}>← До курсу</Link>
      <h1>Журнал оцінок</h1>
      <GradebookTable courseId={id} />
    </div>
  );
}