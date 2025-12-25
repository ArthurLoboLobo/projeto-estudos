import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client/react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useAuth } from '../lib/auth';
import { GET_STUDY_PLAN_HISTORY } from '../lib/graphql/queries';
import { REVISE_STUDY_PLAN, UNDO_STUDY_PLAN, START_STUDYING } from '../lib/graphql/mutations';
import type { Session, StudyPlan } from '../types';

interface SessionPlanningProps {
  session: Session;
  initialPlan: StudyPlan;
  onStartStudying: (session: Session) => void;
}

export default function SessionPlanning({ session, initialPlan, onStartStudying }: SessionPlanningProps) {
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
      toast.success('Study plan updated!');
    } catch (err: any) {
      console.error('Revise error:', err);
      toast.error(err.message || 'Failed to revise study plan');
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
      toast.success('Reverted to previous version');
    } catch (err: any) {
      toast.error(err.message || 'Failed to undo');
    }
  };

  const handleStartStudying = async () => {
    try {
      const result = await startStudying({ variables: { sessionId: session.id } });
      toast.success("Let's start studying!");
      if (result.data?.startStudying) {
        onStartStudying(result.data.startStudying);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start studying');
    }
  };

  return (
    <div className="min-h-screen bg-caky-bg">
      {/* Header */}
      <header className="border-b border-caky-dark/10 bg-white/80 backdrop-blur-md shadow-sm shrink-0 z-10">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-caky-primary hover:text-caky-dark transition font-medium"
            >
              ← Back
            </Link>
            <div className="flex items-center gap-3">
              <img src="/caky_logo.png" alt="Caky Logo" className="w-7 h-7 object-contain" />
              <div>
                <h1 className="text-xl font-bold text-caky-dark">{session.title}</h1>
                {session.description && (
                  <p className="text-sm text-caky-dark/50">{session.description}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-caky-dark/70 text-sm font-medium">{user?.email}</span>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-caky-primary hover:bg-caky-primary/10 rounded-lg transition font-medium"
            >
              Sign Out
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
              <span className="text-caky-dark font-semibold">Upload Materials</span>
            </div>
            <div className="w-8 h-0.5 bg-caky-primary"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-caky-primary text-white flex items-center justify-center font-bold text-sm">2</div>
              <span className="text-caky-primary font-semibold">Plan Your Study</span>
            </div>
            <div className="w-8 h-0.5 bg-caky-dark/20"></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-8 h-8 rounded-full bg-caky-dark/20 text-caky-dark flex items-center justify-center font-bold text-sm">3</div>
              <span className="text-caky-dark font-medium">Start Studying</span>
            </div>
          </div>

          {/* Planning Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-caky-secondary/30 overflow-hidden">
            <div className="p-8 border-b border-caky-secondary/20 text-center bg-gradient-to-r from-caky-primary/5 to-caky-secondary/10">
              <h2 className="text-2xl font-bold text-caky-dark mb-2">Your Study Plan</h2>
              <p className="text-caky-dark/60 max-w-md mx-auto mb-4">
                Review and refine your personalized study plan. Tell the AI how to improve it.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-caky-dark/50">
                <span>Version {currentPlan.version}</span>
                <span>•</span>
                <span>Created {new Date(currentPlan.createdAt).toLocaleTimeString()}</span>
                {canUndo && (
                  <>
                    <span>•</span>
                    <button
                      onClick={handleUndo}
                      className="text-caky-primary hover:text-caky-dark font-medium flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Undo
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Plan Content */}
            <div className="p-8">
              <div className="prose prose-sm max-w-none text-caky-dark/80 prose-headings:text-caky-dark prose-p:text-sm prose-li:text-sm mb-8">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {currentPlan.contentMd}
                </ReactMarkdown>
              </div>

              {/* Refine Section */}
              <div className="border-t border-caky-dark/10 pt-8">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-caky-dark mb-2">Refine Your Plan</h3>
                  <p className="text-caky-dark/60 text-sm">
                    Tell the AI how to improve your study plan
                  </p>
                </div>


                {/* Instruction Input */}
                <form onSubmit={handleRevise} className="space-y-4">
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="e.g., 'Add more practice problems for integrals' or 'Remove the section on limits'"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-caky-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary resize-none text-sm"
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
                          Updating Plan...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Update Plan
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleStartStudying}
                      disabled={revising}
                      className="flex-1 py-3 bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-dark transition disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      Start Studying
                    </button>
                  </div>
                </form>

                {/* Version History */}
                {planHistory.length > 1 && (
                  <div className="mt-6 pt-6 border-t border-caky-dark/10">
                    <p className="text-xs font-semibold text-caky-dark/50 uppercase tracking-wide mb-3">
                      Version History ({planHistory.length})
                    </p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {planHistory.slice(0, 5).map((plan) => (
                        <div
                          key={plan.id}
                          className={`text-xs p-2 rounded-lg ${
                            plan.version === currentPlan.version
                              ? 'bg-caky-primary/10 text-caky-primary font-semibold'
                              : 'text-caky-dark/60 bg-gray-50'
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

