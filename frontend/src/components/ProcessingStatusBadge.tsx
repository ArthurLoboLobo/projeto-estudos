import type { ProcessingStatus } from '../types';

export default function ProcessingStatusBadge({ status }: { status: ProcessingStatus }) {
  // Don't show anything for completed status
  if (status === 'COMPLETED') {
    return (
      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border bg-green-100 text-green-700 border-green-200">
        Pronto
      </span>
    );
  }

  const styles: Record<ProcessingStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    PROCESSING: 'bg-blue-100 text-blue-700 border-blue-200',
    COMPLETED: 'bg-green-100 text-green-700 border-green-200',
    FAILED: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusTranslations: Record<ProcessingStatus, string> = {
    PENDING: 'Pendente',
    PROCESSING: 'Processando',
    COMPLETED: 'Pronto',
    FAILED: 'Falhou',
  };

  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${styles[status] || ''}`}>
      {statusTranslations[status] || status}
    </span>
  );
}
