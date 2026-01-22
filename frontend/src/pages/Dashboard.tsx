import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { GET_SESSIONS } from '../lib/graphql/queries';
import { CREATE_SESSION, DELETE_SESSION } from '../lib/graphql/mutations';
import Header from '../components/Header';
import type { Session, SessionStatus } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();


  const [showNewSession, setShowNewSession] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const { data, loading, error, refetch } = useQuery<{ sessions: Session[] }>(GET_SESSIONS);
  const [createSession, { loading: creating }] = useMutation<{ createSession: Session }>(CREATE_SESSION, {
    onCompleted: (data) => {
      setShowNewSession(false);
      setNewTitle('');
      setNewDescription('');
      toast.success(t('dashboard.toast.sessionCreated'));
      // Navigate to the new session automatically
      if (data?.createSession?.id) {
        navigate(`/session/${data.createSession.id}`);
      } else {
        refetch(); // Fallback: refresh dashboard if navigation fails
      }
    },
    onError: (err) => {
      toast.error(err.message || t('dashboard.toast.createError'));
    },
  });
  const [deleteSession] = useMutation(DELETE_SESSION, {
    onCompleted: () => {
      toast.success(t('dashboard.toast.sessionDeleted'));
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || t('dashboard.toast.deleteError'));
    },
  });

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createSession({
      variables: {
        title: newTitle.trim(),
        description: newDescription.trim() || null,
      },
    });
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm(t('dashboard.session.deleteConfirm'))) return;
    await deleteSession({ variables: { id } });
  };

  const sessions: Session[] = data?.sessions || [];

  return (
    <div className="min-h-screen bg-caky-bg">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-caky-text mb-2">
              {t('dashboard.title')}
            </h1>
            <p className="text-caky-text/60 text-sm md:text-base">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowNewSession(true)}
            className="hidden md:block px-6 py-3 bg-caky-primary text-white font-semibold rounded-xl hover:bg-caky-dark transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {t('dashboard.newSession')}
          </button>
        </div>

        {/* Floating Action Button for Mobile */}
        <button
          onClick={() => setShowNewSession(true)}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-caky-primary text-white rounded-full shadow-xl flex items-center justify-center z-40 active:scale-90 transition-transform"
          aria-label={t('dashboard.newSessionMobile')}
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* New Session Modal */}
        {showNewSession && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4 sm:p-4">
            <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-caky-secondary/30 animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:fade-in-0 duration-200">
              <h2 className="text-xl md:text-2xl font-bold text-caky-text mb-6">
                {t('dashboard.modal.title')}
              </h2>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-caky-text mb-2">
                    {t('dashboard.modal.titleLabel')}
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t('dashboard.modal.titlePlaceholder')}
                    className="w-full px-4 py-3 bg-white dark:bg-caky-card border border-gray-200 dark:border-gray-600 rounded-xl text-caky-text placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-caky-text mb-2">
                    {t('dashboard.modal.descriptionLabel')}
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder={t('dashboard.modal.descriptionPlaceholder')}
                    rows={3}
                    className="w-full px-4 py-3 bg-white dark:bg-caky-card border border-gray-200 dark:border-gray-600 rounded-xl text-caky-text placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewSession(false)}
                    className="flex-1 py-3 text-caky-text bg-gray-100 dark:bg-caky-card hover:bg-gray-200 dark:hover:bg-caky-card/70 rounded-xl transition font-medium active:scale-95"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-3 bg-caky-primary text-white font-semibold rounded-xl hover:bg-caky-dark transition disabled:opacity-50 shadow-md active:scale-95"
                  >
                    {creating ? t('common.creating') : t('common.create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sessions Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-caky-primary border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600">
            {t('dashboard.errors.loadSessions')} {error.message}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-caky-text/10">
            <h3 className="text-2xl font-bold text-caky-text mb-3">
              {t('dashboard.empty.title')}
            </h3>
            <p className="text-caky-text/60 mb-8 max-w-md mx-auto">
              {t('dashboard.empty.subtitle')}
            </p>
            <button
              onClick={() => setShowNewSession(true)}
              className="px-6 py-3 bg-caky-primary text-white font-semibold rounded-xl hover:bg-caky-dark transition shadow-md"
            >
              {t('dashboard.empty.cta')}
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white rounded-2xl p-6 border border-caky-secondary/30 hover:border-caky-primary/50 hover:shadow-lg transition group relative overflow-hidden flex flex-col h-full"
              >
                <div className="absolute top-4 right-4 md:top-0 md:right-0 md:p-6 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent navigating if clicking delete
                      handleDeleteSession(session.id);
                    }}
                    className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition p-2 bg-white dark:bg-caky-card rounded-full shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-100 md:border-transparent active:scale-90"
                    title={t('dashboard.session.deleteTitle')}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-4 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2 pr-10 md:pr-0">
                    <h3 className="text-xl font-bold text-caky-text group-hover:text-caky-primary transition">
                      {session.title}
                    </h3>
                  </div>
                  <div className="mb-3">
                    <StatusBadge status={session.status} />
                  </div>
                  {session.description && (
                    <p className="text-caky-text/60 text-sm line-clamp-2 min-h-[2.5em]">
                      {session.description}
                    </p>
                  )}
                  {!session.description && (
                    <p className="text-caky-text/40 text-sm italic min-h-[2.5em]">
                      {t('dashboard.session.noDescription')}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-caky-text/40 font-medium">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </div>
                  <Link
                    to={`/session/${session.id}`}
                    className="px-4 py-2 bg-caky-secondary/20 text-caky-primary font-semibold rounded-lg hover:bg-caky-primary hover:text-white transition text-sm active:scale-95"
                  >
                    {t('dashboard.session.openSession')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useTranslation();
  
  const config: Record<SessionStatus, { labelKey: string; className: string }> = {
    PLANNING: {
      labelKey: 'dashboard.status.planning',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    },
    ACTIVE: {
      labelKey: 'dashboard.status.active',
      className: 'bg-green-100 text-green-700 border-green-200',
    },
    COMPLETED: {
      labelKey: 'dashboard.status.completed',
      className: 'bg-blue-100 text-blue-700 border-blue-200',
    },
  };

  const statusConfig = config[status] || config.PLANNING;

  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border whitespace-nowrap ${statusConfig.className}`}>
      {t(statusConfig.labelKey)}
    </span>
  );
}
