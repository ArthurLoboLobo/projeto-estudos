import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { GET_SESSIONS } from '../lib/graphql/queries';
import { CREATE_SESSION, DELETE_SESSION } from '../lib/graphql/mutations';
import type { Session } from '../types';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [showNewSession, setShowNewSession] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const { data, loading, error, refetch } = useQuery(GET_SESSIONS);
  const [createSession, { loading: creating }] = useMutation(CREATE_SESSION, {
    onCompleted: () => {
      setShowNewSession(false);
      setNewTitle('');
      setNewDescription('');
      toast.success('Session created!');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create session');
    },
  });
  const [deleteSession] = useMutation(DELETE_SESSION, {
    onCompleted: () => {
      toast.success('Session deleted');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete session');
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
    if (!confirm('Are you sure you want to delete this session?')) return;
    await deleteSession({ variables: { id } });
  };

  const sessions: Session[] = data?.sessions || [];

  return (
    <div className="min-h-screen bg-caky-bg">
      {/* Header */}
      <header className="border-b border-caky-dark/10 bg-caky-card/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-caky-primary flex items-center gap-2">
            <img src="/caky_logo.png" alt="Caky Logo" className="w-8 h-8 object-contain" />
            Caky
          </Link>
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
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-caky-dark mb-2">
              Your Study Sessions
            </h1>
            <p className="text-caky-dark/60">
              Create a session for each course or exam you're preparing for
            </p>
          </div>
          <button
            onClick={() => setShowNewSession(true)}
            className="px-6 py-3 bg-caky-primary text-white font-semibold rounded-xl hover:bg-caky-dark transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            + New Session
          </button>
        </div>

        {/* New Session Modal */}
        {showNewSession && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-caky-secondary/30">
              <h2 className="text-2xl font-bold text-caky-dark mb-6">
                Create Study Session
              </h2>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-caky-dark mb-2">
                    Session Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Calculus II Final Exam"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-caky-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-caky-dark mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Topics, exam date, notes..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-caky-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewSession(false)}
                    className="flex-1 py-3 text-caky-dark bg-gray-100 hover:bg-gray-200 rounded-xl transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-3 bg-caky-primary text-white font-semibold rounded-xl hover:bg-caky-dark transition disabled:opacity-50 shadow-md"
                  >
                    {creating ? 'Creating...' : 'Create'}
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
            Error loading sessions: {error.message}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-caky-dark/10">
            <div className="text-6xl mb-6">📚</div>
            <h3 className="text-2xl font-bold text-caky-dark mb-3">
              No study sessions yet
            </h3>
            <p className="text-caky-dark/60 mb-8 max-w-md mx-auto">
              Create your first session to start studying with AI context from your documents.
            </p>
            <button
              onClick={() => setShowNewSession(true)}
              className="px-6 py-3 bg-caky-primary text-white font-semibold rounded-xl hover:bg-caky-dark transition shadow-md"
            >
              + Create First Session
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white rounded-2xl p-6 border border-caky-secondary/30 hover:border-caky-primary/50 hover:shadow-lg transition group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault(); // Prevent navigating if clicking delete
                      handleDeleteSession(session.id);
                    }}
                    className="text-gray-400 hover:text-red-500 transition p-1 bg-white rounded-full shadow-sm hover:bg-red-50"
                    title="Delete session"
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

                <div className="mb-4">
                  <h3 className="text-xl font-bold text-caky-dark group-hover:text-caky-primary transition mb-2 pr-8">
                    {session.title}
                  </h3>
                  {session.description && (
                    <p className="text-caky-dark/60 text-sm line-clamp-2 min-h-[2.5em]">
                      {session.description}
                    </p>
                  )}
                  {!session.description && (
                    <p className="text-caky-dark/40 text-sm italic min-h-[2.5em]">
                      No description
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                  <div className="text-xs text-caky-dark/40 font-medium">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </div>
                  <Link
                    to={`/session/${session.id}`}
                    className="px-4 py-2 bg-caky-secondary/20 text-caky-primary font-semibold rounded-lg hover:bg-caky-primary hover:text-white transition text-sm"
                  >
                    Open Session →
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
