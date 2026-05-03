import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { courses } from '../../data/seed';
import Placeholder from '../../components/Placeholder';

export default function AdminCourseEditor() {
  const { id } = useParams<{ id: string }>();
  const course = courses.find((c) => c.id === id);
  if (!course) return <Navigate to="/admin/cursos" replace />;

  return (
    <div className="space-y-4">
      <Link
        to="/admin/cursos"
        className="text-xs font-medium text-pco-blue hover:underline inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} strokeWidth={2} />
        Voltar aos cursos
      </Link>
      <Placeholder
        title={`Editor — ${course.title}`}
        subtitle="Dados gerais, módulos, materiais, avaliações, certificado e regras de retenção."
        description="Editor completo do curso será implementado nas próximas iterações, com formulários por aba (geral, módulos, aulas, avaliações, certificado)."
      />
    </div>
  );
}
