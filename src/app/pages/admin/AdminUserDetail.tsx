import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Placeholder from '../../components/Placeholder';

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <Link
        to="/admin/alunos"
        className="text-xs font-medium text-pco-blue hover:underline inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} strokeWidth={2} />
        Voltar aos alunos
      </Link>
      <Placeholder
        title={`Aluno #${id}`}
        subtitle="Perfil acadêmico, progresso, risco, cursos, avaliações, certificados e histórico."
        description="Visão 360° do aluno com Tutor, PCO POD, Biblioteca e histórico de reengajamento."
      />
    </div>
  );
}
