import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useAuth, getAuthToken } from '../lib/auth';
import { GET_SESSION, GET_DOCUMENTS, GET_MESSAGES, GET_DOCUMENT_URL } from '../lib/graphql/queries';
import { DELETE_DOCUMENT, SEND_MESSAGE, CLEAR_MESSAGES } from '../lib/graphql/mutations';
import type { Document, Message } from '../types';

const API_BASE = import.meta.env.VITE_GRAPHQL_ENDPOINT?.replace('/graphql', '') || 'http://localhost:8080';

export default function Session() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [messageInput, setMessageInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: sessionData, error: sessionError } = useQuery(GET_SESSION, {
    variables: { id },
    skip: !id,
  });
  const { data: documentsData, refetch: refetchDocs } = useQuery(GET_DOCUMENTS, {
    variables: { sessionId: id },
    skip: !id,
  });
  const { data: messagesData, refetch: refetchMessages, loading: loadingMessages } = useQuery(GET_MESSAGES, {
    variables: { sessionId: id },
    skip: !id,
  });

  // Mutations
  const [deleteDocument] = useMutation(DELETE_DOCUMENT);
  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE);
  const [clearMessages] = useMutation(CLEAR_MESSAGES);

  // Lazy query for document URL
  const [fetchDocumentUrl] = useLazyQuery(GET_DOCUMENT_URL, {
    fetchPolicy: 'network-only',
  });

  const session = sessionData?.session;
  const documents: Document[] = documentsData?.documents || [];
  const serverMessages: Message[] = messagesData?.messages || [];
  
  // State for optimistic UI messages
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [aiTyping, setAiTyping] = useState(false);
  
  // Combine server messages with optimistic messages
  const messages: Message[] = [...serverMessages, ...optimisticMessages];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Redirect if session not found
  useEffect(() => {
    if (sessionError) {
      toast.error('Session not found');
      navigate('/dashboard');
    }
  }, [sessionError, navigate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are supported');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast.error('File size must be less than 50MB');
      return;
    }

    setUploading(true);
    setUploadProgress('Uploading...');

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Upload file to backend (which handles storage + processing)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', id!);

      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      // Handle response - safely parse JSON
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

      toast.success('Document uploaded! Text extraction in progress...');
      refetchDocs();

      // Poll for extraction completion
      pollDocumentStatus();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Poll for document extraction status
  const pollDocumentStatus = () => {
    const interval = setInterval(() => {
      refetchDocs().then(({ data }) => {
        const docs = data?.documents || [];
        const allComplete = docs.every(
          (d: Document) => d.extractionStatus === 'completed' || d.extractionStatus === 'failed'
        );
        if (allComplete) {
          clearInterval(interval);
          const failed = docs.filter((d: Document) => d.extractionStatus === 'failed');
          if (failed.length > 0) {
            toast.error(`${failed.length} document(s) failed to process`);
          }
        }
      });
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  const handleViewDocument = async (doc: Document) => {
    console.log('Viewing document:', doc.id, doc.fileName);
    setSelectedDocument(doc);
    setPdfUrl(null);
    setPdfError(null);
    setPdfLoading(true);
    
    try {
      const result = await fetchDocumentUrl({ variables: { id: doc.id } });
      console.log('Document URL result:', result);
      if (result.data?.documentUrl) {
        setPdfUrl(result.data.documentUrl);
      } else if (result.error) {
        setPdfError(result.error.message);
      } else {
        setPdfError('No URL returned from server');
      }
    } catch (err: any) {
      console.error('Error fetching document URL:', err);
      setPdfError(err.message || 'Failed to fetch document');
    } finally {
      setPdfLoading(false);
    }
  };

  const closePdfViewer = () => {
    setSelectedDocument(null);
    setPdfUrl(null);
    setPdfError(null);
  };

  const handleDeleteDocument = async (docId: string, fileName: string) => {
    if (!confirm(`Remove "${fileName}"?`)) return;

    try {
      await deleteDocument({ variables: { id: docId } });
      toast.success('Document removed');
      refetchDocs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete document');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending) return;

    const content = messageInput.trim();
    setMessageInput('');

    // Create optimistic message for immediate UI feedback
    const optimisticMessage: Message = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    
    // Add optimistic message to UI immediately
    setOptimisticMessages([optimisticMessage]);
    setAiTyping(true);

    try {
      // Send message to backend (this also triggers AI response)
      await sendMessage({
        variables: { sessionId: id, content },
      });
      
      // Clear optimistic messages and fetch real messages from server
      setOptimisticMessages([]);
      setAiTyping(false);
      refetchMessages();
    } catch (err: any) {
      console.error('Send error:', err);
      toast.error(err.message || 'Failed to send message');
      setMessageInput(content); // Restore on error
      setOptimisticMessages([]); // Clear optimistic message on error
      setAiTyping(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear all chat history?')) return;

    try {
      await clearMessages({ variables: { sessionId: id } });
      toast.success('Chat cleared');
      refetchMessages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear chat');
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-sm shrink-0">
        <div className="px-4 md:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Link
              to="/dashboard"
              className="text-purple-300 hover:text-white transition shrink-0"
            >
              ← Back
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-white truncate">{session.title}</h1>
              {session.description && (
                <p className="text-sm text-purple-300/60 truncate hidden md:block">{session.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <span className="text-purple-300 text-sm hidden md:block">{user?.email}</span>
            <button
              onClick={logout}
              className="px-3 md:px-4 py-2 text-sm text-purple-300 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar - Documents (collapsible on mobile) */}
        <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-white/10 bg-black/20 flex flex-col shrink-0 max-h-48 md:max-h-none">
          <div className="p-4 border-b border-white/10">
            <div className="flex justify-between items-center mb-3 md:mb-4">
              <h2 className="text-base md:text-lg font-semibold text-white">Study Materials</h2>
              <span className="text-xs text-purple-300/50 md:hidden">
                {documents.length} doc{documents.length !== 1 ? 's' : ''}
              </span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-2 md:py-3 border-2 border-dashed border-purple-500/50 hover:border-purple-500 text-purple-300 hover:text-white rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
                  {uploadProgress || 'Uploading...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload PDF
                </>
              )}
            </button>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 md:space-y-3">
            {documents.length === 0 ? (
              <div className="text-center py-4 md:py-8 text-purple-300/50">
                <div className="text-2xl md:text-3xl mb-2">📄</div>
                <p className="text-sm">No documents yet</p>
                <p className="text-xs mt-1 hidden md:block">Upload PDFs to give context to the AI</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white/5 rounded-xl p-3 md:p-4 border border-white/10 group hover:bg-white/10 transition cursor-pointer"
                  onClick={() => handleViewDocument(doc)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                      <span className="text-xl md:text-2xl shrink-0">📄</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs md:text-sm font-medium truncate">
                          {doc.fileName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={doc.extractionStatus} />
                          {doc.pageCount && (
                            <span className="text-xs text-purple-300/50 hidden md:inline">
                              {doc.pageCount} pages
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc.id, doc.fileName);
                      }}
                      className="opacity-100 md:opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4">
            {loadingMessages ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="text-5xl md:text-6xl mb-4 md:mb-6">🤖</div>
                <h3 className="text-xl md:text-2xl font-semibold text-white mb-2 md:mb-3">
                  Ready to help you study!
                </h3>
                <p className="text-purple-300/70 max-w-md text-sm md:text-base">
                  Upload your course materials, then ask me anything about them.
                  I'll help you understand concepts, solve problems, and prepare for exams.
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {aiTyping && (
                  <div className="flex justify-start mb-4">
                    <div className="max-w-[85%] md:max-w-2xl rounded-2xl px-4 py-3 bg-[#202c33] text-gray-100 rounded-tl-none border border-white/5 shadow-md">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-sm text-purple-300/70">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          <div className="border-t border-white/10 bg-black/20 p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-purple-300/50">
                {documents.length} doc{documents.length !== 1 ? 's' : ''} loaded
              </span>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="text-xs text-purple-300/50 hover:text-red-400 transition ml-auto"
                >
                  Clear chat
                </button>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2 md:gap-3">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Ask about your study materials..."
                className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm md:text-base"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !messageInput.trim()}
                className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm md:text-base"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span className="hidden md:inline">Thinking...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden md:inline">Send</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* PDF Viewer Modal */}
      {selectedDocument && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closePdfViewer}
        >
          <div 
            className="bg-slate-900 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">📄</span>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold truncate">{selectedDocument.fileName}</h3>
                  <p className="text-sm text-purple-300/60">
                    {selectedDocument.pageCount ? `${selectedDocument.pageCount} pages` : 'Document'}
                  </p>
                </div>
              </div>
              <button
                onClick={closePdfViewer}
                className="text-white/50 hover:text-white transition p-2 hover:bg-white/10 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-hidden">
              {pdfLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-purple-300">Loading document...</p>
                  </div>
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title={selectedDocument.fileName}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-red-400 mb-2">Failed to load document</p>
                    {pdfError && (
                      <p className="text-xs text-gray-400 max-w-md">{pdfError}</p>
                    )}
                    <button
                      onClick={() => handleViewDocument(selectedDocument)}
                      className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    processing: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-300 border-green-500/30',
    failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status] || ''}`}>
      {status}
    </span>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] md:max-w-2xl rounded-2xl px-4 py-3 shadow-md relative ${
          isUser
            ? 'bg-[#005c4b] text-white rounded-tr-none'
            : 'bg-[#202c33] text-gray-100 rounded-tl-none border border-white/5'
        }`}
      >
        <div className="prose prose-sm md:prose-base prose-invert max-w-none leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        <div 
          className={`text-[10px] mt-2 text-right ${
            isUser ? 'text-white/60' : 'text-gray-400'
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
