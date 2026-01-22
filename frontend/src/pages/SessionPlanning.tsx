import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { REVISE_PLAN, START_STUDYING, UPDATE_DRAFT_TOPIC_COMPLETION } from '../lib/graphql/mutations';
import Header from '../components/Header';
import type { Session, DraftPlanTopic } from '../types';

interface SessionPlanningProps {
  session: Session;
  onSessionUpdate: (session: Session) => void;
}

export default function SessionPlanning({ session, onSessionUpdate }: SessionPlanningProps) {
  const [instruction, setInstruction] = useState('');
  const [revising, setRevising] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [revisePlan] = useMutation<{ revisePlan: Session }>(REVISE_PLAN);
  const [startStudying, { loading: startingStudying }] = useMutation<{ startStudying: Session }>(START_STUDYING);
  const [updateDraftTopicCompletion] = useMutation<{ updateDraftTopicCompletion: Session }>(UPDATE_DRAFT_TOPIC_COMPLETION);

  const topics: DraftPlanTopic[] = session.draftPlan?.topics || [];

  const handleRevise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || revising) return;

    setRevising(true);
    try {
      const result = await revisePlan({
        variables: { sessionId: session.id, instruction: instruction.trim() },
      });
      if (result.data?.revisePlan) {
        onSessionUpdate(result.data.revisePlan);
      }
      setInstruction('');
      toast.success('Plano de estudo atualizado!');
    } catch (err: any) {
      console.error('Revise error:', err);
      toast.error(err.message || 'Falha ao revisar plano de estudo');
    } finally {
      setRevising(false);
    }
  };

  const handleStartStudying = async () => {
    try {
      const result = await startStudying({ variables: { sessionId: session.id } });
      toast.success("Vamos começar a estudar!");
      if (result.data?.startStudying) {
        onSessionUpdate(result.data.startStudying);
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao começar a estudar');
    }
  };

  const handleToggleCompletion = async (topicId: string, currentlyCompleted: boolean) => {
    try {
      const result = await updateDraftTopicCompletion({
        variables: {
          sessionId: session.id,
          topicId,
          isCompleted: !currentlyCompleted,
        },
      });
      if (result.data?.updateDraftTopicCompletion) {
        onSessionUpdate(result.data.updateDraftTopicCompletion);
      }
    } catch (err: any) {
      console.error('Toggle completion error:', err);
      toast.error(err.message || 'Falha ao atualizar tópico');
    }
  };

  const activeTopicsCount = topics.filter(t => !t.isCompleted).length;

  return (
    <div className="min-h-screen bg-caky-bg">
      {/* Header */}
      <Header
        sessionTitle={session.title}
        showBackButton={true}
      />

      {/* Main Content */}
      <main className="flex-1 flex items-start md:items-center justify-center p-4 md:p-6 overflow-auto">
        <div className="w-full max-w-4xl pb-20 md:pb-0">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-6 md:mb-8">
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs md:text-sm">1</div>
              <span className="text-caky-text font-semibold text-xs md:text-base hidden md:inline">Enviar</span>
              <span className="text-caky-text font-semibold text-xs md:text-base md:hidden">Env.</span>
            </div>
            <div className="w-4 md:w-8 h-0.5 bg-caky-primary"></div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-caky-primary text-white flex items-center justify-center font-bold text-xs md:text-sm">2</div>
              <span className="text-caky-primary font-semibold text-xs md:text-base hidden md:inline">Planejar</span>
              <span className="text-caky-primary font-semibold text-xs md:text-base md:hidden">Plan.</span>
            </div>
            <div className="w-4 md:w-8 h-0.5 bg-caky-text/20"></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-caky-text/20 text-caky-text flex items-center justify-center font-bold text-xs md:text-sm">3</div>
              <span className="text-caky-text font-medium text-xs md:text-base hidden md:inline">Estudar</span>
              <span className="text-caky-text font-medium text-xs md:text-base md:hidden">Est.</span>
            </div>
          </div>

          {/* Planning Card */}
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-caky-secondary/30 overflow-hidden">
            <div className="p-6 md:p-8 border-b border-caky-secondary/20 text-center bg-gradient-to-r from-caky-primary/5 to-caky-secondary/10">
              <h2 className="text-xl md:text-2xl font-bold text-caky-text mb-2">Seu Plano de Estudo</h2>
              <p className="text-sm md:text-base text-caky-text/60 max-w-md mx-auto mb-4">
                Revise e refine seu plano de estudo personalizado. Marque os tópicos que você já sabe bem para pular.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-xs text-caky-text/50">
                <span>{topics.length} tópicos • {activeTopicsCount} para estudar</span>
              </div>
            </div>

            {/* Plan Content - Topics List */}
            <div className="p-4 md:p-8">
              <div className="space-y-3 md:space-y-4 mb-8">
                {topics.map((topic, index) => (
                  <div
                    key={topic.id}
                    className={`flex flex-col md:flex-row md:items-start gap-3 md:gap-4 p-4 rounded-xl border transition ${
                      topic.isCompleted
                        ? 'bg-gray-50 dark:bg-caky-card/20 border-gray-200 dark:border-gray-700 opacity-60'
                        : 'bg-gray-50 dark:bg-caky-card/30 border-gray-200 dark:border-gray-700 hover:border-caky-primary/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 md:gap-4 w-full md:w-auto">
                      {/* Topic Number */}
                      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        topic.isCompleted
                          ? 'bg-gray-300 text-gray-500'
                          : 'bg-caky-primary text-white'
                      }`}>
                        {topic.isCompleted ? '✓' : index + 1}
                      </div>

                      {/* Topic Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold text-sm mb-1 ${topic.isCompleted ? 'text-caky-text/50 line-through' : 'text-caky-text'}`}>
                          {topic.title}
                        </h3>
                        {topic.description && (
                          <div className={`text-sm prose prose-sm max-w-none dark:prose-invert ${topic.isCompleted ? 'text-caky-text/40' : 'text-caky-text/60'}`}>
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                            >
                              {topic.description}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Checkbox for "Already know" */}
                    <div className="md:shrink-0 pl-11 md:pl-0 mt-2 md:mt-0 flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          topic.isCompleted
                            ? 'bg-caky-primary border-caky-primary'
                            : 'bg-white border-gray-300 group-hover:border-caky-primary'
                        }`}>
                          {topic.isCompleted && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={topic.isCompleted}
                          onChange={() => handleToggleCompletion(topic.id, topic.isCompleted)}
                        />
                        <span className={`text-sm font-medium ${topic.isCompleted ? 'text-caky-text/60' : 'text-caky-text/80'}`}>
                          Já domino este tópico
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Refine Section */}
              <div className="border-t border-caky-text/10 pt-6 md:pt-8">
                <div className="mb-4 md:mb-6">
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
                  <div className="flex flex-col md:flex-row gap-3">
                    <button
                      type="submit"
                      disabled={!instruction.trim() || revising}
                      className="w-full md:flex-1 py-3 bg-caky-secondary text-caky-dark font-bold rounded-xl hover:bg-caky-secondary/80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
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
                      type="button"
                      onClick={handleStartStudying}
                      disabled={revising || startingStudying || topics.length === 0}
                      className="w-full md:flex-1 py-3 bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-dark transition disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 active:scale-95"
                    >
                      {startingStudying ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Preparando a Sessão de Estudo...
                        </>
                      ) : (
                        'Começar a Estudar'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
