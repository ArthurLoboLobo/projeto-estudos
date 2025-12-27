import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import { useAuth, getAuthToken } from '../lib/auth';
import { GET_DOCUMENTS } from '../lib/graphql/queries';
import { DELETE_DOCUMENT, START_PLANNING } from '../lib/graphql/mutations';
import ThemeToggle from '../components/ui/ThemeToggle';
import type { Document, Session, StudyPlan } from '../types';

const API_BASE = import.meta.env.VITE_GRAPHQL_ENDPOINT?.replace('/graphql', '') || 'http://localhost:8080';

interface SessionUploadProps {
  session: Session;
  onPlanGenerated: (plan: StudyPlan) => void;
}

export default function SessionUpload({ session, onPlanGenerated }: SessionUploadProps) {
  const { user, logout } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documentsData, refetch: refetchDocs } = useQuery<{ documents: Document[] }>(GET_DOCUMENTS, {
    variables: { sessionId: session.id },
    pollInterval: 3000, // Poll every 3 seconds for status updates
  });

  const [deleteDocument] = useMutation(DELETE_DOCUMENT);
  const [startPlanning] = useMutation<{ startPlanning: StudyPlan }>(START_PLANNING);

  const documents: Document[] = documentsData?.documents || [];
  const hasCompletedDocs = documents.some(d => d.extractionStatus === 'completed');
  const hasPendingDocs = documents.some(d => d.extractionStatus === 'pending' || d.extractionStatus === 'processing');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Apenas arquivos PDF são suportados');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('O tamanho do arquivo deve ser menor que 50MB');
      return;
    }

    setUploading(true);
    setUploadProgress('Uploading...');

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', session.id);

      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { error: text || 'Upload failed' };
      }

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      toast.success('Documento enviado! Extração de texto em andamento...');
      refetchDocs();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Falha ao enviar documento');
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteDocument = async (docId: string, fileName: string) => {
    if (!confirm(`Remover "${fileName}"?`)) return;

    try {
      await deleteDocument({ variables: { id: docId } });
      toast.success('Documento removido');
      refetchDocs();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao excluir documento');
    }
  };

  const handleStartPlanning = async () => {
    if (!hasCompletedDocs) {
      toast.error('Aguarde pelo menos um documento terminar de processar');
      return;
    }

    setGenerating(true);
    try {
      const result = await startPlanning({ variables: { sessionId: session.id } });
      toast.success('Plano de estudo gerado!');
      if (result.data?.startPlanning) {
        onPlanGenerated(result.data.startPlanning);
      }
    } catch (err: any) {
      console.error('Planning error:', err);
      toast.error(err.message || 'Falha ao gerar plano de estudo');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-caky-bg">
      {/* Header */}
      <header className="border-b border-caky-text/10 bg-white/80 backdrop-blur-md shadow-sm shrink-0 z-10 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-4">
            <Link
              to="/dashboard"
              className="text-caky-primary hover:text-caky-text transition font-medium"
            >
              <span className="hidden md:inline">← Voltar</span>
              <span className="md:hidden">←</span>
            </Link>
            <div className="flex items-center gap-2 md:gap-3">
              <img src="/caky_logo.png" alt="Caky Logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" />
              <div className="max-w-[150px] md:max-w-none">
                <h1 className="text-base md:text-xl font-bold text-caky-text truncate">{session.title}</h1>
                {session.description && (
                  <p className="text-xs md:text-sm text-caky-text/50 truncate hidden md:block">{session.description}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <ThemeToggle />
            <span className="text-caky-text/70 text-sm font-medium hidden md:inline">{user?.email}</span>
            <button
              onClick={logout}
              className="px-3 md:px-4 py-2 text-sm text-caky-primary hover:bg-caky-primary/10 rounded-lg transition font-medium active:scale-95"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-start md:items-center justify-center p-4 md:p-6 overflow-auto">
        <div className="w-full max-w-2xl pb-20 md:pb-0">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-6 md:mb-8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-caky-primary text-white flex items-center justify-center font-bold text-xs md:text-sm">1</div>
              <span className="text-caky-primary font-semibold text-xs md:text-base">Enviar</span>
            </div>
            <div className="w-4 md:w-8 h-0.5 bg-caky-text/20"></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-caky-text/20 text-caky-text flex items-center justify-center font-bold text-xs md:text-sm">2</div>
              <span className="text-caky-text font-medium text-xs md:text-base hidden md:inline">Planejar</span>
              <span className="text-caky-text font-medium text-xs md:text-base md:hidden">Plan.</span>
            </div>
            <div className="w-4 md:w-8 h-0.5 bg-caky-text/20"></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-caky-text/20 text-caky-text flex items-center justify-center font-bold text-xs md:text-sm">3</div>
              <span className="text-caky-text font-medium text-xs md:text-base hidden md:inline">Estudar</span>
              <span className="text-caky-text font-medium text-xs md:text-base md:hidden">Est.</span>
            </div>
          </div>

          {/* Upload Card */}
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-caky-secondary/30 overflow-hidden">
            <div className="p-6 md:p-8 border-b border-caky-secondary/20 text-center bg-gradient-to-r from-caky-primary/5 to-caky-secondary/10">
              <h2 className="text-xl md:text-2xl font-bold text-caky-text mb-2">Envie Seus Materiais</h2>
              <p className="text-sm md:text-base text-caky-text/60 max-w-md mx-auto">
                Faça upload de provas antigas, slides de aula e anotações. A IA irá analisá-los para criar um plano de estudo personalizado.
              </p>
            </div>

            {/* Upload Area */}
            <div className="p-4 md:p-8">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || generating}
                className="w-full py-6 md:py-8 border-2 border-dashed border-caky-primary/40 hover:border-caky-primary bg-caky-primary/5 hover:bg-caky-primary/10 text-caky-primary hover:text-caky-text rounded-2xl transition flex flex-col items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-caky-primary border-t-transparent"></div>
                    <span className="font-semibold">{uploadProgress || 'Enviando...'}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="font-bold text-base md:text-lg">Upload de Arquivos</span>
                    <span className="text-xs md:text-sm text-caky-text/50">Provas antigas, slides, anotações (máx. 50MB)</span>
                  </>
                )}
              </button>

              {/* Document List */}
              {documents.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-bold text-caky-text/70 uppercase tracking-wide">Documentos Enviados</h3>
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-caky-card/30 rounded-xl border border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <div className="min-w-0">
                          <p className="text-caky-text font-semibold text-sm truncate">{doc.fileName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={doc.extractionStatus} />
                            {doc.pageCount && (
                              <span className="text-xs text-caky-text/50">{doc.pageCount} pages</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                        disabled={generating}
                        className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 shrink-0 active:scale-90"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Start Planning Button */}
              <div className="mt-8">
                <button
                  onClick={handleStartPlanning}
                  disabled={!hasCompletedDocs || generating || hasPendingDocs}
                  className="w-full py-4 bg-caky-primary text-white font-bold text-lg rounded-xl hover:bg-caky-dark transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span className="text-base md:text-lg">Gerando Plano...</span>
                    </>
                  ) : hasPendingDocs ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/50 border-t-transparent"></div>
                      <span className="text-base md:text-lg">Processando...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base md:text-lg">Começar Planejamento</span>
                    </>
                  )}
                </button>
                {documents.length === 0 && (
                  <p className="text-center text-caky-text/50 text-xs md:text-sm mt-3">
                    Envie pelo menos um documento para continuar
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  // Don't show anything for completed status
  if (status === 'completed') {
    return null;
  }

  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    processing: 'bg-blue-100 text-blue-700 border-blue-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
  };

  const icons: Record<string, string> = {
    pending: '',
    processing: '',
    failed: '',
  };

  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${styles[status] || ''}`}>
      {icons[status]} {status}
    </span>
  );
}