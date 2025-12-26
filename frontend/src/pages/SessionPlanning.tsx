import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { GET_STUDY_PLAN_HISTORY } from '../lib/graphql/queries';
import { REVISE_STUDY_PLAN, UNDO_STUDY_PLAN, START_STUDYING, UPDATE_TOPIC_STATUS } from '../lib/graphql/mutations';
import ThemeToggle from '../components/ui/ThemeToggle';
import type { Session, StudyPlan, TopicStatus } from '../types';

interface SessionPlanningProps {
  session: Session;
  initialPlan: StudyPlan;
  onStartStudying: (session: Session) => void;
  onRefetchPlan: () => void;
}

export default function SessionPlanning({ session, initialPlan, onStartStudying, onRefetchPlan }: SessionPlanningProps) {
  const { user, logout } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<StudyPlan>(initialPlan);
  const [instruction, setInstruction] = useState('');
  const [revising, setRevising] = useState(false);

  const { data: historyData, refetch: refetchHistory } = useQuery<{ studyPlanHistory: StudyPlan[] }>(GET_STUDY_PLAN_HISTORY, {
    variables: { sessionId: session.id },
  });

  const [revisePlan] = useMutation<{ reviseStudyPlan: StudyPlan }>(REVISE_STUDY_PLAN);
  const [undoPlan] = useMutation<{ undoStudyPlan: StudyPlan }>(UNDO_STUDY_PLAN);
  const [startStudying] = useMutation<{ startStudying: Session }>(START_STUDYING);
  const [updateTopicStatus] = useMutation<{ updateTopicStatus: StudyPlan }>(UPDATE_TOPIC_STATUS);

  const planHistory: StudyPlan[] = historyData?.studyPlanHistory || [];
  const canUndo = currentPlan.version > 1;

  const handleRevise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || revising) return;

    setRevising(true);
    try {
      const result = await revisePlan({
        variables: { sessionId: session.id, instruction: instruction.trim() },
      });
      if (result.data?.reviseStudyPlan) {
        setCurrentPlan(result.data.reviseStudyPlan);
      }
      setInstruction('');
      refetchHistory();
      onRefetchPlan(); // Refetch the study plan in parent component
      toast.success('Plano de estudo atualizado!');
    } catch (err: any) {
      console.error('Revise error:', err);
      toast.error(err.message || 'Falha ao revisar plano de estudo');
    } finally {
      setRevising(false);
    }
  };

  const handleUndo = async () => {
    if (!canUndo) return;

    try {
      const result = await undoPlan({ variables: { sessionId: session.id } });
      if (result.data?.undoStudyPlan) {
        setCurrentPlan(result.data.undoStudyPlan);
      }
      refetchHistory();
      onRefetchPlan(); // Refetch the study plan in parent component
      toast.success('Revertido para versão anterior');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao desfazer');
    }
  };

  const handleStartStudying = async () => {
    try {
      const result = await startStudying({ variables: { sessionId: session.id } });
      toast.success("Vamos começar a estudar!");
      if (result.data?.startStudying) {
        onStartStudying(result.data.startStudying);
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao começar a estudar');
    }
  };

  const handleStatusChange = async (topicId: string, newStatus: TopicStatus) => {
    try {
      const result = await updateTopicStatus({
        variables: {
          sessionId: session.id,
          topicId,
          status: newStatus,
        },
      });
      if (result.data?.updateTopicStatus) {
        setCurrentPlan(result.data.updateTopicStatus);
      }
      onRefetchPlan(); // Refetch the study plan in parent component
      toast.success('Status do tópico atualizado');
    } catch (err: any) {
      console.error('Status update error:', err);
      toast.error(err.message || 'Falha ao atualizar status');
    }
  };

  const getStatusColor = (status: TopicStatus): string => {
    switch (status) {
      case 'need_to_learn': return 'bg-red-100 text-red-700 border-red-200';
      case 'need_review': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'know_well': return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  return (
    <div className="min-h-screen bg-caky-bg">
      {/* Header */}
      <header className="border-b border-caky-text/10 bg-white/80 backdrop-blur-md shadow-sm shrink-0 z-10">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-caky-primary hover:text-caky-text transition font-medium"
            >
              ← Voltar
            </Link>
            <div className="flex items-center gap-3">
              <img src="/caky_logo.png" alt="Caky Logo" className="w-7 h-7 object-contain" />
              <div>
                <h1 className="text-xl font-bold text-caky-text">{session.title}</h1>
                {session.description && (
                  <p className="text-sm text-caky-text/50">{session.description}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <span className="text-caky-text/70 text-sm font-medium">{user?.email}</span>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-caky-primary hover:bg-caky-primary/10 rounded-lg transition font-medium"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 overflow-auto">
        <div className="w-full max-w-4xl">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">1</div>
              <span className="text-caky-text font-semibold">Enviar Materiais</span>
            </div>
            <div className="w-8 h-0.5 bg-caky-primary"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-caky-primary text-white flex items-center justify-center font-bold text-sm">2</div>
              <span className="text-caky-primary font-semibold">Planejar Estudos</span>
            </div>
            <div className="w-8 h-0.5 bg-caky-text/20"></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-8 h-8 rounded-full bg-caky-text/20 text-caky-text flex items-center justify-center font-bold text-sm">3</div>
              <span className="text-caky-text font-medium">Começar a Estudar</span>
            </div>
          </div>

          {/* Planning Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-caky-secondary/30 overflow-hidden">
            <div className="p-8 border-b border-caky-secondary/20 text-center bg-gradient-to-r from-caky-primary/5 to-caky-secondary/10">
              <h2 className="text-2xl font-bold text-caky-text mb-2">Seu Plano de Estudo</h2>
              <p className="text-caky-text/60 max-w-md mx-auto mb-4">
                Revise e refine seu plano de estudo personalizado. Diga à IA como melhorá-lo.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-caky-text/50">
                <span>Versão {currentPlan.version}</span>
                <span>•</span>
                <span>Criado {new Date(currentPlan.createdAt).toLocaleTimeString()}</span>
                {canUndo && (
                  <>
                    <span>•</span>
                    <button
                      onClick={handleUndo}
                      className="text-caky-primary hover:text-caky-text font-medium flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Voltar para versão anterior
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Plan Content - Topics List */}
            <div className="p-8">
              <div className="space-y-4 mb-8">
                {currentPlan.content.topics.map((topic, index) => (
                  <div
                    key={topic.id}
                    className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-caky-card/30 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-caky-primary/30 transition"
                  >
                    {/* Topic Number */}
                    <div className="shrink-0 w-8 h-8 rounded-full bg-caky-primary text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>

                    {/* Topic Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-caky-text mb-1">{topic.title}</h3>
                      <p className="text-sm text-caky-text/60">{topic.description}</p>
                    </div>

                    {/* Status Dropdown */}
                    <select
                      value={topic.status}
                      onChange={(e) => handleStatusChange(topic.id, e.target.value as TopicStatus)}
                      className={`shrink-0 px-3 py-2 text-sm font-medium rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 transition ${getStatusColor(topic.status)}`}
                    >
                      <option value="need_to_learn">Preciso Aprender</option>
                      <option value="need_review">Preciso Revisar</option>
                      <option value="know_well">Sei Bem</option>
                    </select>
                  </div>
                ))}
              </div>

              {/* Refine Section */}
              <div className="border-t border-caky-text/10 pt-8">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-caky-text mb-2">Refine Seu Plano</h3>
                  <p className="text-caky-text/60 text-sm">
                    Diga à IA como melhorar seu plano de estudo
                  </p>
                </div>


                {/* Instruction Input */}
                <form onSubmit={handleRevise} className="space-y-4">
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="ex.: 'Adicione mais exercícios práticos de integrais' ou 'Remova a seção sobre limites'"
                    className="w-full p-4 bg-gray-50 dark:bg-caky-card/50 border border-gray-200 dark:border-gray-600 rounded-xl text-caky-text placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary resize-none text-sm"
                    rows={4}
                    disabled={revising}
                  />
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={!instruction.trim() || revising}
                      className="flex-1 py-3 bg-caky-secondary text-caky-dark font-bold rounded-xl hover:bg-caky-secondary/80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {revising ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-caky-dark border-t-transparent"></div>
                          Atualizando Plano...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Atualizar Plano
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleStartStudying}
                      disabled={revising}
                      className="flex-1 py-3 bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-dark transition disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      Começar a Estudar
                    </button>
                  </div>
                </form>

                {/* Histórico de Versões */}
                {planHistory.length > 1 && (
                  <div className="mt-6 pt-6 border-t border-caky-text/10">
                    <p className="text-xs font-semibold text-caky-text/50 uppercase tracking-wide mb-3">
                      Histórico de Versões ({planHistory.length})
                    </p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {planHistory.slice(0, 5).map((plan) => (
                        <div
                          key={plan.id}
                          className={`text-xs p-2 rounded-lg ${
                            plan.version === currentPlan.version
                              ? 'bg-caky-primary/10 text-caky-primary font-semibold'
                              : 'text-caky-text/60 bg-gray-50 dark:bg-caky-card/30'
                          }`}
                        >
                          v{plan.version}: {plan.instruction || 'Initial plan'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
