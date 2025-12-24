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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-white">
            📚 StudyMate
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-purple-300 text-sm">{user?.email}</span>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-purple-300 hover:text-white hover:bg-white/10 rounded-lg transition"
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
            <h1 className="text-3xl font-bold text-white mb-2">
              Your Study Sessions
            </h1>
            <p className="text-purple-300/70">
              Create a session for each course or exam you're preparing for
            </p>
          </div>
          <button
            onClick={() => setShowNewSession(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition shadow-lg shadow-purple-500/30"
          >
            + New Session
          </button>
        </div>

        {/* New Session Modal */}
        {showNewSession && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-white/20 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">
                Create Study Session
              </h2>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Session Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Calculus II Final Exam"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Topics, exam date, notes..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewSession(false)}
                    className="flex-1 py-3 text-white bg-white/10 hover:bg-white/20 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
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
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-300">
            Error loading sessions: {error.message}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">📚</div>
            <h3 className="text-2xl font-semibold text-white mb-3">
              No study sessions yet
            </h3>
            <p className="text-purple-300/70 mb-8">
              Create your first session to start studying with AI
            </p>
            <button
              onClick={() => setShowNewSession(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition"
            >
              + Create First Session
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-purple-500/50 transition group"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-white group-hover:text-purple-300 transition">
                    {session.title}
                  </h3>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="text-white/30 hover:text-red-400 transition p-1"
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
                {session.description && (
                  <p className="text-purple-200/60 text-sm mb-4 line-clamp-2">
                    {session.description}
                  </p>
                )}
                <div className="text-xs text-purple-300/50 mb-4">
                  Created {new Date(session.createdAt).toLocaleDateString()}
                </div>
                <Link
                  to={`/session/${session.id}`}
                  className="block w-full py-3 text-center bg-white/10 hover:bg-purple-600 text-white rounded-xl transition"
                >
                  Open Session →
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
