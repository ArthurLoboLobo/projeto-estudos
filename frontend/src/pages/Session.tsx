import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { toast } from 'sonner';
import { useAuth, getAuthToken } from '../lib/auth';
import { GET_SESSION, GET_DOCUMENTS, GET_MESSAGES, GET_DOCUMENT_URL, GET_STUDY_PLAN } from '../lib/graphql/queries';
import { DELETE_DOCUMENT, SEND_MESSAGE, GENERATE_WELCOME, REVISE_STUDY_PLAN, UPDATE_TOPIC_STATUS, UNDO_STUDY_PLAN, UNDO_MESSAGE } from '../lib/graphql/mutations';
import SessionHeader from '../components/SessionHeader';
import Markdown from '../components/ui/Markdown';
import type { Document, Message, Session as SessionType, StudyPlan } from '../types';
import SessionUpload from './SessionUpload';
import SessionPlanning from './SessionPlanning';

const API_BASE = import.meta.env.VITE_GRAPHQL_ENDPOINT?.replace('/graphql', '') || 'http://localhost:8080';

export default function Session() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionType | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);

  // Fetch session data
  const { data: sessionData, error: sessionError, refetch: refetchSession } = useQuery<{ session: SessionType }>(GET_SESSION, {
    variables: { id },
    skip: !id,
  });

  // Fetch study plan
  const { data: planData, refetch: refetchPlan } = useQuery<{ studyPlan: StudyPlan | null }>(GET_STUDY_PLAN, {
    variables: { sessionId: id },
    skip: !id,
  });

  // Update local state when data changes
  useEffect(() => {
    if (sessionData?.session) {
      setSession(sessionData.session);
    }
  }, [sessionData]);

  useEffect(() => {
    if (planData?.studyPlan !== undefined) {
      setStudyPlan(planData.studyPlan);
    }
  }, [planData]);

  // Redirect if session not found
  useEffect(() => {
    if (sessionError) {
      toast.error('Sessão não encontrada');
      navigate('/dashboard');
    }
  }, [sessionError, navigate]);

  // Loading state
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-caky-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-caky-primary border-t-transparent"></div>
      </div>
    );
  }

  // Route based on stage
  if (session.stage === 'UPLOADING') {
    return (
      <SessionUpload
        session={session}
        onPlanGenerated={(plan) => {
          setStudyPlan(plan);
          setSession({ ...session, stage: 'PLANNING' });
          refetchSession();
          refetchPlan();
        }}
      />
    );
  }

  if (session.stage === 'PLANNING') {
    if (!studyPlan) {
      // Still loading plan
      return (
        <div className="min-h-screen flex items-center justify-center bg-caky-bg">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-caky-primary border-t-transparent"></div>
        </div>
      );
    }
    return (
      <SessionPlanning
        session={session}
        initialPlan={studyPlan}
        onStartStudying={(updatedSession) => {
          setSession(updatedSession);
          refetchSession();
        }}
        onRefetchPlan={refetchPlan}
      />
    );
  }

  // STUDYING stage - render the main study view
  return (
    <SessionStudying
      session={session}
      studyPlan={studyPlan}
      onRefetchPlan={refetchPlan}
    />
  );
}

// The main studying interface
interface SessionStudyingProps {
  session: SessionType;
  studyPlan: StudyPlan | null;
  onRefetchPlan: () => void;
}

function SessionStudying({ session, studyPlan, onRefetchPlan }: SessionStudyingProps) {
  const { user, logout } = useAuth();
  const [messageInput, setMessageInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [materialsCollapsed, setMaterialsCollapsed] = useState(true); // Start collapsed on mobile
  const [studyPlanCollapsed, setStudyPlanCollapsed] = useState(true); // Start collapsed on mobile
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [messageToUndo, setMessageToUndo] = useState<string | null>(null);
  const [isFullscreenChat, setIsFullscreenChat] = useState(false); // Mobile fullscreen mode
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Queries
  const { data: documentsData, refetch: refetchDocs } = useQuery<{ documents: Document[] }>(GET_DOCUMENTS, {
    variables: { sessionId: session.id },
  });
  const { data: messagesData, loading: loadingMessages, refetch: refetchMessages } = useQuery<{ messages: Message[] }>(GET_MESSAGES, {
    variables: { sessionId: session.id },
  });

  // Mutations
  const [deleteDocument] = useMutation(DELETE_DOCUMENT);
  const [sendMessage, { loading: sending }] = useMutation<{ sendMessage: Message }, { sessionId: string, content: string }>(SEND_MESSAGE);
  const [generateWelcome, { loading: generatingWelcome }] = useMutation<{ generateWelcome: Message }, { sessionId: string }>(GENERATE_WELCOME);
  const [undoMessage] = useMutation<{ undoMessage: string }, { messageId: string }>(UNDO_MESSAGE);

  // Lazy query for document URL
  const [fetchDocumentUrl] = useLazyQuery<{ documentUrl: string }>(GET_DOCUMENT_URL, {
    fetchPolicy: 'network-only',
  });

  const documents: Document[] = documentsData?.documents || [];
  const serverMessages: Message[] = messagesData?.messages || [];
  
  // State for optimistic UI messages and AI typing indicator
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [aiTyping, setAiTyping] = useState(false);
  
  // Combine server messages with optimistic messages for immediate UI feedback
  const messages: Message[] = [...serverMessages, ...optimisticMessages];

  // Track if we've already triggered the welcome message
  const [welcomeTriggered, setWelcomeTriggered] = useState(false);

  // Auto-trigger welcome message when chat loads with no messages
  useEffect(() => {
    // Only trigger once, when messages are loaded and empty
    if (!loadingMessages && serverMessages.length === 0 && !welcomeTriggered && !generatingWelcome) {
      setWelcomeTriggered(true);
      setAiTyping(true);
      
      // Generate welcome message from AI (no user message needed)
      generateWelcome({
        variables: { sessionId: session.id },
        onCompleted: () => {
          refetchMessages();
          setAiTyping(false);
        },
        onError: (err) => {
          console.error('Welcome message error:', err);
          setAiTyping(false);
        }
      });
    }
  }, [loadingMessages, serverMessages.length, welcomeTriggered, generatingWelcome, session.id, generateWelcome, refetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        // Use requestAnimationFrame for smooth scrolling on mobile
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [messages]);

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
    setUploadProgress('Enviando...');

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
        data = { error: text || 'Falha no envio' };
      }

      if (!response.ok) {
        throw new Error(data.error || 'Falha no envio');
      }

      toast.success('Documento enviado! Extração de texto em andamento...');
      refetchDocs();
      pollDocumentStatus();
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
            toast.error(`${failed.length} documento(s) falharam ao processar`);
          }
        }
      });
    }, 3000);

    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  const handleViewDocument = async (doc: Document) => {
    setSelectedDocument(doc);
    setPdfUrl(null);
    setPdfError(null);
    setPdfLoading(true);
    
    try {
      const result = await fetchDocumentUrl({ variables: { id: doc.id } });
      if (result.data?.documentUrl) {
        setPdfUrl(result.data.documentUrl);
      } else if (result.error) {
        setPdfError(result.error.message);
      } else {
        setPdfError('Nenhuma URL retornada pelo servidor');
      }
    } catch (err: any) {
      setPdfError(err.message || 'Falha ao buscar documento');
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
    if (!confirm(`Remover "${fileName}"?`)) return;

    try {
      await deleteDocument({ variables: { id: docId } });
      toast.success('Documento removido');
      refetchDocs();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao excluir documento');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending) return;

    const content = messageInput.trim();
    setMessageInput('');

    // Reset textarea height to default
    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto';
    }

    const optimisticMessage: Message = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    setOptimisticMessages([optimisticMessage]);
    setAiTyping(true);

    try {
      await sendMessage({
        variables: { sessionId: session.id, content },
        onCompleted: (data) => {
          if (data?.sendMessage) {
            // Refetch messages to get the updated list including both user and AI messages
            refetchMessages();
            // Clear optimistic UI since real data will be loaded
            setOptimisticMessages([]);
          }
        },
      });

      setAiTyping(false);
    } catch (err: any) {
      console.error('Send error:', err);
      toast.error(err.message || 'Falha ao enviar mensagem');
      setMessageInput(content);
      setOptimisticMessages([]);
      setAiTyping(false);
    }
  };

  const handleUndoMessage = async (messageId: string) => {
    setMessageToUndo(messageId);
    setShowUndoConfirm(true);
  };

  const confirmUndo = async () => {
    if (!messageToUndo) return;

    setShowUndoConfirm(false);
    const messageId = messageToUndo;
    setMessageToUndo(null);

    try {
      const result = await undoMessage({
        variables: { messageId },
      });

      if (result.data?.undoMessage) {
        // Put the message content back in the input box
        setMessageInput(result.data.undoMessage);
        // Reset textarea height to auto-adjust to new content
        if (messageInputRef.current) {
          messageInputRef.current.style.height = 'auto';
          const maxHeight = isMobile ? 120 : 200;
          messageInputRef.current.style.height = Math.min(messageInputRef.current.scrollHeight, maxHeight) + 'px';
        }
        // Refetch messages to update the list
        refetchMessages();
        toast.success('Mensagem desfeita');
      }
    } catch (err: any) {
      console.error('Undo error:', err);
      toast.error(err.message || 'Falha ao desfazer mensagem');
    }
  };

  const cancelUndo = () => {
    setShowUndoConfirm(false);
    setMessageToUndo(null);
  };


  return (
    <div className="h-screen flex flex-col bg-caky-bg">
      {/* Header */}
      {!isFullscreenChat && (
        <SessionHeader
          session={session}
          user={user}
          onLogout={logout}
          isMobile={isMobile}
          hideLogoOnMobile={true}
          extraActions={isMobile ? (
            <button
              onClick={() => setIsFullscreenChat(true)}
              className="p-2 text-caky-text/70 hover:text-caky-text hover:bg-caky-secondary/20 rounded-lg transition"
              title="Fullscreen Chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          ) : null}
        />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex ${isMobile ? 'flex-col' : 'lg:flex-row'} overflow-hidden ${isFullscreenChat ? 'fixed inset-0 z-50 bg-white flex-col' : ''}`}>
        {/* Fullscreen Chat Header */}
        {isFullscreenChat && (
          <header className="border-b border-caky-text/10 bg-caky-card/80 backdrop-blur-md shadow-sm shrink-0 z-10 px-4 py-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setIsFullscreenChat(false)}
                  className="p-2 text-caky-text/70 hover:text-caky-text hover:bg-caky-secondary/20 rounded-lg transition active:scale-95"
                  title="Voltar"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-caky-text truncate">{session.title}</h1>
                  {session.description && (
                    <p className="text-sm text-caky-text/50 truncate hidden sm:block">{session.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {studyPlan && (
                  <button
                    onClick={() => setShowEditPlanModal(true)}
                    className="px-3 py-2 text-sm text-caky-primary hover:bg-caky-primary/10 rounded-lg transition active:scale-95 font-medium"
                  >
                    Editar Plano
                  </button>
                )}
                <span className="text-caky-text/70 text-sm hidden sm:block font-medium">{user?.email}</span>
                <button
                  onClick={logout}
                  className="px-3 py-2 text-sm text-caky-primary hover:bg-caky-primary/10 rounded-lg transition active:scale-95 font-medium"
                >
                  Sair
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Left Sidebar - Study Materials */}
        <aside className={`${isMobile && materialsCollapsed && !isFullscreenChat ? 'hidden' : ''} ${isFullscreenChat ? 'hidden' : ''} border-b lg:border-b-0 lg:border-r border-caky-text/10 bg-caky-secondary/10 flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${
          materialsCollapsed
            ? `w-full lg:w-12 ${isMobile ? 'h-0' : 'h-48 lg:h-full max-h-48 lg:max-h-none'}`
            : `w-full lg:w-80 ${isMobile ? 'h-auto max-h-[40vh]' : 'h-48 lg:h-full max-h-48 lg:max-h-none'}`
        }`}>
          <div className="flex-1 flex flex-col min-h-0">
            <button
              onClick={() => setMaterialsCollapsed(!materialsCollapsed)}
              className={`border-b border-caky-text/5 bg-caky-secondary/5 hover:bg-caky-secondary/10 transition-colors text-left ${
                materialsCollapsed
                  ? 'lg:w-12 lg:h-full lg:flex lg:flex-col lg:items-center lg:justify-start lg:p-2 lg:border-b-0'
                  : 'w-full p-4'
              }`}
            >
              {materialsCollapsed ? (
                <div className="lg:flex lg:flex-col lg:items-center lg:justify-start lg:pt-4">
                  <svg
                    className="w-4 h-4 text-caky-text/50 transition-transform hover:text-caky-text"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-bold text-caky-text">Materiais de Estudo</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-caky-text/50">
                      {documents.length} doc{documents.length !== 1 ? 's' : ''}
                    </span>
                    <svg
                      className="w-4 h-4 text-caky-text/50 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                </div>
              )}
            </button>

            {!materialsCollapsed && (
              <>
                <div className="px-4 pt-4 pb-4">
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
                    className="w-full py-3 px-4 border-2 border-dashed border-caky-primary/30 hover:border-caky-primary text-caky-primary hover:text-caky-text hover:bg-caky-primary/5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm font-semibold"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-caky-primary border-t-transparent"></div>
                        {uploadProgress || 'Enviando...'}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload de Arquivos
                      </>
                    )}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {documents.length === 0 ? (
                    <div className="text-center py-4 text-caky-text/40">
                      <p className="text-xs font-medium">Nenhum documento ainda</p>
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white dark:bg-caky-card rounded-lg p-2 shadow-sm hover:shadow hover:border-caky-primary/30 transition cursor-pointer group text-xs"
                        onClick={() => handleViewDocument(doc)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-caky-text font-semibold truncate">{doc.fileName}</p>
                              <StatusBadge status={doc.extractionStatus} />
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDocument(doc.id, doc.fileName);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-red-500 transition p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <main className={`flex-1 flex flex-col min-w-0 bg-white ${isMobile ? 'min-h-0' : ''}`}>
          {/* Mobile Chat Controls */}
          {isMobile && !isFullscreenChat && (
            <div className="flex items-center justify-between px-4 py-3 bg-caky-card border-b border-caky-text/10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMaterialsCollapsed(!materialsCollapsed)}
                  className={`p-3 text-caky-text/70 hover:text-caky-text hover:bg-caky-secondary/20 rounded-xl transition active:scale-95 ${
                    !materialsCollapsed ? 'bg-caky-primary text-white' : ''
                  }`}
                  title="Materiais de Estudo"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V9l4-4m0 0L15 9m4-4v4a2 2 0 01-2 2h-4" />
                  </svg>
                </button>
                {studyPlan && (
                  <button
                    onClick={() => setStudyPlanCollapsed(!studyPlanCollapsed)}
                    className={`p-3 text-caky-text/70 hover:text-caky-text hover:bg-caky-secondary/20 rounded-xl transition active:scale-95 ${
                      !studyPlanCollapsed ? 'bg-caky-primary text-white' : ''
                    }`}
                    title="Plano de Estudos"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V9l4-4m0 0L15 9m4-4v4a2 2 0 01-2 2h-4" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-caky-text/60 font-medium">
                  {session.title.length > 15 ? `${session.title.substring(0, 15)}...` : session.title}
                </div>
                <button
                  onClick={() => setIsFullscreenChat(true)}
                  className="p-3 text-caky-text/70 hover:text-caky-text hover:bg-caky-secondary/20 rounded-xl transition active:scale-95"
                  title="Chat Completo"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className={`flex-1 relative ${isMobile ? 'min-h-0' : ''}`}>
            <div
              className={`absolute inset-0 overflow-y-auto ${isMobile ? 'overscroll-contain touch-pan-y' : ''} p-4 md:p-6 space-y-4 md:space-y-6 bg-caky-bg scroll-smooth`}
              style={isMobile ? {
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.2) transparent'
              } : {}}
            >
              {loadingMessages && messages.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-caky-primary border-t-transparent"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-full text-center px-4 opacity-80">
                  <h3 className="text-xl md:text-2xl font-bold text-caky-text mb-2 md:mb-3">
                    Pronto para te ajudar a estudar!
                  </h3>
                  <p className="text-caky-text/60 max-w-md text-sm md:text-base font-medium">
                    Pergunte-me qualquer coisa sobre seus materiais de estudo. Vou ajudá-lo a entender conceitos, resolver problemas e se preparar para sua prova.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <MessageBubble 
                      key={msg.id} 
                      message={msg} 
                      isMobile={isMobile} 
                      onUndo={handleUndoMessage}
                    />
                  ))}
                  {aiTyping && (
                    <div className="flex justify-start mb-4">
                      <div className={`max-w-[85%] md:max-w-2xl rounded-2xl ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} bg-white text-caky-text rounded-tl-none border border-caky-secondary/30 shadow-sm`}>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-caky-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-caky-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-caky-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                          <span className="text-sm text-caky-text/50 font-medium">Caky está pensando...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </div>

          {/* Message Input */}
          <div className={`border-t border-caky-text/10 bg-white ${isMobile ? 'p-3 pb-safe' : 'p-3 md:p-4'} shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]`}>
            {isFullscreenChat && (
              <div className="flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFullscreenChat(false)}
                    className="p-2 text-caky-text/70 hover:text-caky-text hover:bg-caky-secondary/20 rounded-lg transition"
                    title="Exit Fullscreen"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <span className="text-sm font-medium text-caky-text/70">Chat Mode</span>
                </div>
                <div className="text-xs text-caky-text/50">
                  {session.title}
                </div>
              </div>
            )}
            <form onSubmit={handleSendMessage} className={`flex ${isMobile ? 'gap-3' : 'gap-2 md:gap-3'}`}>
              <textarea
                ref={messageInputRef}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                onKeyPress={(e) => {
                  // Allow Shift+Enter for line breaks
                  if (e.key === 'Enter' && e.shiftKey) {
                    // Let the default behavior happen (insert line break)
                    return;
                  }
                }}
                placeholder={isMobile ? "Pergunte..." : "Pergunte qualquer coisa..."}
                className={`flex-1 ${isMobile ? 'px-4 py-3 min-h-[56px]' : 'px-3 md:px-4 py-2 md:py-3'} bg-gray-50 dark:bg-caky-card/50 border border-gray-200 dark:border-gray-600 rounded-xl text-caky-text placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary ${isMobile ? 'text-base resize-none' : 'text-sm md:text-base'} transition resize-none`}
                disabled={sending}
                autoComplete="off"
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck="true"
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: isMobile ? '56px' : '52px',
                  maxHeight: isMobile ? '120px' : '200px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  const maxHeight = isMobile ? 120 : 200;
                  const newHeight = Math.min(target.scrollHeight, maxHeight);
                  target.style.height = newHeight + 'px';

                  // Show scrollbar only when content exceeds max height
                  if (target.scrollHeight > maxHeight) {
                    target.style.overflowY = 'auto';
                  } else {
                    target.style.overflowY = 'hidden';
                  }
                }}
              />
              <button
                type="submit"
                disabled={sending || !messageInput.trim()}
                className={`${isMobile ? 'px-5 py-3 min-h-[44px]' : 'px-4 md:px-6 py-2 md:py-3'} bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-primary transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${isMobile ? 'text-base active:scale-95' : 'text-sm md:text-base'} shadow-md`}
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    {!isMobile && <span className="hidden md:inline">Pensando...</span>}
                  </>
                ) : (
                  <>
                    {!isMobile && <span className="hidden md:inline">Enviar</span>}
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </main>

        {/* Right Sidebar - Study Plan */}
        {studyPlan && (
          <aside className={`${isMobile && studyPlanCollapsed && !isFullscreenChat ? 'hidden' : ''} ${isFullscreenChat ? 'hidden' : ''} border-b lg:border-b-0 lg:border-l border-caky-text/10 bg-caky-secondary/10 flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${
            studyPlanCollapsed
              ? `w-full lg:w-12 ${isMobile ? 'h-0' : 'h-48 lg:h-full max-h-48 lg:max-h-none'}`
              : `w-full lg:w-80 ${isMobile ? 'h-auto max-h-[40vh]' : 'h-48 lg:h-full max-h-48 lg:max-h-none'}`
          }`}>
            <div className="flex-1 flex flex-col min-h-0">
              <button
                onClick={() => setStudyPlanCollapsed(!studyPlanCollapsed)}
                className={`border-b border-caky-text/5 bg-caky-secondary/5 hover:bg-caky-secondary/10 transition-colors text-left ${
                  studyPlanCollapsed
                    ? 'lg:w-12 lg:h-full lg:flex lg:flex-col lg:items-center lg:justify-start lg:p-2 lg:border-b-0'
                    : 'w-full p-4'
                }`}
              >
                {studyPlanCollapsed ? (
                  <div className="lg:flex lg:flex-col lg:items-center lg:justify-start lg:pt-4">
                    <svg
                      className="w-4 h-4 text-caky-text/50 transition-transform hover:text-caky-text"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <h2 className="text-base font-bold text-caky-text">Plano de Estudos</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-caky-text/50">
                        {studyPlan.content.topics.length} tópico{studyPlan.content.topics.length !== 1 ? 's' : ''}
                      </span>
                      <svg
                        className="w-4 h-4 text-caky-text/50 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
              {!studyPlanCollapsed && (
                <>
                  <div className="px-4 pt-4 pb-4">
                    <button
                      onClick={() => setShowEditPlanModal(true)}
                      className="w-full py-3 px-4 border-2 border-dashed border-caky-primary/30 hover:border-caky-primary text-caky-primary hover:text-caky-text hover:bg-caky-primary/5 rounded-xl transition flex items-center justify-center gap-2 text-sm font-semibold"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar plano de estudos
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-3">
                  {studyPlan.content.topics.map((topic, index) => {
                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'need_to_learn': return 'bg-red-100 text-red-700';
                        case 'need_review': return 'bg-yellow-100 text-yellow-700';
                        case 'know_well': return 'bg-green-100 text-green-700';
                        default: return 'bg-gray-100 dark:bg-caky-card text-gray-700 dark:text-gray-300';
                      }
                    };

                    const getStatusLabel = (status: string) => {
                      switch (status) {
                        case 'need_to_learn': return 'Preciso Aprender';
                        case 'need_review': return 'Preciso Revisar';
                        case 'know_well': return 'Sei Bem';
                        default: return 'Desconhecido';
                      }
                    };

                    return (
                      <div
                        key={topic.id}
                        className="p-3 bg-white dark:bg-caky-card rounded-lg shadow-sm"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <div className="shrink-0 w-6 h-6 rounded-full bg-caky-primary text-white flex items-center justify-center font-bold text-xs">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-caky-text text-xs mb-1">{topic.title}</h4>
                            <p className="text-[10px] text-caky-text/60 leading-relaxed">{topic.description}</p>
                          </div>
                        </div>
                        <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${getStatusColor(topic.status)}`}>
                          {getStatusLabel(topic.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Undo Message Confirmation Modal */}
      {showUndoConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-caky-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-caky-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-caky-text mb-2">Confirmar Desfazer</h3>
              <p className="text-caky-text/70 text-sm leading-relaxed mb-6">
                Tem certeza que deseja desfazer esta mensagem? Isso também removerá todas as mensagens posteriores nesta conversa.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelUndo}
                  className="flex-1 px-4 py-2 text-caky-text border border-gray-200 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmUndo}
                  className="flex-1 px-4 py-2 bg-caky-primary text-white rounded-lg hover:bg-caky-primary/90 transition font-medium"
                >
                  Desfazer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Study Plan Modal */}
      {showEditPlanModal && studyPlan && (
        <EditStudyPlanModal
          studyPlan={studyPlan}
          onClose={() => setShowEditPlanModal(false)}
          onRefetchPlan={onRefetchPlan}
          sessionId={session.id}
        />
      )}

      {/* PDF Viewer Modal */}
      {selectedDocument && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closePdfViewer}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-caky-card/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <h3 className="text-caky-text font-bold truncate">{selectedDocument.fileName}</h3>
                  <p className="text-sm text-caky-text/50 font-medium">
                    {selectedDocument.pageCount ? `${selectedDocument.pageCount} páginas` : 'Documento'}
                  </p>
                </div>
              </div>
              <button
                onClick={closePdfViewer}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition p-2 hover:bg-gray-100 dark:hover:bg-caky-card/50 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-caky-card/20">
              {pdfLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-caky-primary border-t-transparent mx-auto mb-4"></div>
                    <p className="text-caky-text/60 font-medium">Carregando documento...</p>
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
                    <p className="text-red-500 mb-2 font-medium">Falha ao carregar documento</p>
                    {pdfError && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">{pdfError}</p>
                    )}
                    <button
                      onClick={() => handleViewDocument(selectedDocument)}
                      className="mt-4 px-4 py-2 bg-caky-primary hover:bg-caky-dark text-white rounded-lg transition font-medium"
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

// Edit Study Plan Modal Component
interface EditStudyPlanModalProps {
  studyPlan: StudyPlan;
  onClose: () => void;
  onRefetchPlan: () => void;
  sessionId: string;
}

function EditStudyPlanModal({ studyPlan, onClose, onRefetchPlan, sessionId }: EditStudyPlanModalProps) {
  const [revisionInstruction, setRevisionInstruction] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [localStudyPlan, setLocalStudyPlan] = useState(studyPlan);

  // Update local study plan when prop changes
  useEffect(() => {
    setLocalStudyPlan(studyPlan);
  }, [studyPlan]);

  const [reviseStudyPlan] = useMutation<{ reviseStudyPlan: StudyPlan }>(REVISE_STUDY_PLAN, {
    onCompleted: (data) => {
      if (data?.reviseStudyPlan) {
        setLocalStudyPlan(data.reviseStudyPlan);
        onRefetchPlan();
        setRevisionInstruction('');
        toast.success('Plano de estudos atualizado!');
      }
      setIsRevising(false);
    },
    onError: (error: any) => {
      console.error('Revision error:', error);
      console.error('Error details:', error.graphQLErrors, error.networkError);

      // Try to get a more specific error message
      let errorMessage = 'Erro ao atualizar plano de estudos';
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        const graphQLError = error.graphQLErrors[0].message;
        // Provide user-friendly messages for common errors
        if (graphQLError.includes('Session must be in')) {
          errorMessage = 'Não é possível editar o plano neste estágio.';
        } else if (graphQLError.includes('No study plan found')) {
          errorMessage = 'Nenhum plano de estudos encontrado para esta sessão.';
        } else if (graphQLError.includes('JSON')) {
          errorMessage = 'Erro ao processar a resposta da IA. Tente novamente.';
        } else {
          errorMessage = graphQLError;
        }
      } else if (error.networkError) {
        errorMessage = 'Erro de conexão. Verifique sua internet.';
      }

      toast.error(errorMessage);
      setIsRevising(false);
    }
  });

  const [updateTopicStatus] = useMutation<{ updateTopicStatus: StudyPlan }>(UPDATE_TOPIC_STATUS, {
    onCompleted: (data) => {
      if (data?.updateTopicStatus) {
        setLocalStudyPlan(data.updateTopicStatus);
        onRefetchPlan();
      }
    },
    onError: (error: any) => {
      console.error('Status update error:', error);
      console.error('Error details:', error.graphQLErrors, error.networkError);

      // Try to get a more specific error message
      let errorMessage = 'Erro ao atualizar status do tópico';
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMessage = error.graphQLErrors[0].message || errorMessage;
      } else if (error.networkError) {
        errorMessage = 'Erro de conexão. Verifique sua internet.';
      }

      toast.error(errorMessage);
    }
  });

  const [undoStudyPlan] = useMutation<{ undoStudyPlan: StudyPlan }>(UNDO_STUDY_PLAN, {
    onCompleted: (data) => {
      if (data?.undoStudyPlan) {
        setLocalStudyPlan(data.undoStudyPlan);
        onRefetchPlan();
        toast.success('Revertido para versão anterior');
      }
    },
    onError: (error) => {
      console.error('Undo error:', error);
      toast.error(error.message || 'Falha ao desfazer');
    }
  });

  const handleRevisePlan = async () => {
    if (!revisionInstruction.trim()) return;

    setIsRevising(true);
    try {
      await reviseStudyPlan({
        variables: {
          sessionId,
          instruction: revisionInstruction.trim()
        }
      });
    } catch (error) {
      console.error('Revision error:', error);
    }
  };

  const handleStatusChange = async (topicId: string, newStatus: string) => {
    try {
      await updateTopicStatus({
        variables: {
          sessionId,
          topicId,
          status: newStatus
        }
      });
    } catch (error) {
      console.error('Status update error:', error);
    }
  };

  const handleUndo = async () => {
    try {
      await undoStudyPlan({
        variables: { sessionId }
      });
    } catch (error) {
      console.error('Undo error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'need_to_learn': return 'bg-red-100 text-red-700';
      case 'need_review': return 'bg-yellow-100 text-yellow-700';
      case 'know_well': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 dark:bg-caky-card text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'need_to_learn': return 'Preciso Aprender';
      case 'need_review': return 'Preciso Revisar';
      case 'know_well': return 'Sei Bem';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-caky-card/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-caky-text">Editar Plano de Estudos</h2>
              <div className="flex items-center gap-4 text-xs text-caky-text/50 mt-1">
                <span>Versão {localStudyPlan.version}</span>
                <span>•</span>
                <span>Criado {new Date(localStudyPlan.createdAt).toLocaleTimeString()}</span>
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
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition p-2 hover:bg-gray-100 dark:hover:bg-caky-card/50 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Study Plan Topics */}
          <div className="p-6">
            <h3 className="text-lg font-bold text-caky-text mb-4">Tópicos do Plano</h3>
            <div className="space-y-4">
              {localStudyPlan.content.topics.map((topic, index) => (
                <div
                  key={topic.id}
                  className="p-4 bg-white dark:bg-caky-card rounded-lg shadow-sm"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-caky-primary text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-caky-text text-sm mb-2">{topic.title}</h4>
                      <p className="text-xs text-caky-text/70 leading-relaxed">{topic.description}</p>
                    </div>
                  </div>

                  {/* Status Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-caky-text/70">Status:</span>
                    <select
                      value={topic.status}
                      onChange={(e) => handleStatusChange(topic.id, e.target.value)}
                      className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-caky-primary/50"
                    >
                      <option value="need_to_learn">Preciso Aprender</option>
                      <option value="need_review">Preciso Revisar</option>
                      <option value="know_well">Sei Bem</option>
                    </select>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(topic.status)}`}>
                      {getStatusLabel(topic.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Revision Section */}
          <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-caky-card/30">
            <h3 className="text-lg font-bold text-caky-text mb-4">Revisar Plano com IA</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-caky-text mb-2">
                  Descreva como deseja modificar o plano:
                </label>
                <textarea
                  value={revisionInstruction}
                  onChange={(e) => setRevisionInstruction(e.target.value)}
                  placeholder="Ex: Adicione mais exercícios de cálculo, foque nos capítulos 5-8, etc."
                  className="w-full px-3 py-3 bg-white dark:bg-caky-card border border-gray-200 dark:border-gray-600 rounded-lg text-caky-text placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary resize-none"
                  rows={3}
                />
              </div>
              <button
                onClick={handleRevisePlan}
                disabled={!revisionInstruction.trim() || isRevising}
                className="px-6 py-3 bg-caky-primary text-white font-bold rounded-lg hover:bg-caky-dark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRevising ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Revisar Plano
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
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

  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${styles[status] || ''}`}>
      {status}
    </span>
  );
}

interface MessageBubbleProps {
  message: Message;
  isMobile: boolean;
  onUndo?: (messageId: string) => void;
}

function MessageBubble({ message, isMobile, onUndo }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isOptimistic = message.id.startsWith('optimistic-');

  // For user messages, preserve line breaks exactly as typed
  // For assistant messages, use markdown rendering
  const renderContent = () => {
    if (isUser) {
      // Use white-space: pre-wrap to preserve all whitespace including line breaks
      return (
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>
      );
    } else {
      // Use Markdown component for assistant messages (supports LaTeX, tables, etc.)
      return (
        <Markdown isUserMessage={false} isMobile={isMobile}>
          {message.content}
        </Markdown>
      );
    }
  };

  return (
    <div className={`group flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'} ${isMobile ? 'mb-4 px-1' : 'mb-4'}`}>
      {/* Undo button for user messages - appears on hover */}
      {isUser && onUndo && !isOptimistic && (
        <button
          onClick={() => onUndo(message.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-caky-primary hover:bg-gray-100 rounded-lg"
          title="Desfazer mensagem"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
      )}
      <div
        className={`max-w-[90%] md:max-w-2xl rounded-2xl ${isMobile ? 'px-4 py-3' : 'px-5 py-3'} shadow-sm relative ${
          isUser
            ? 'bg-caky-primary text-white rounded-tr-sm'
            : 'bg-white text-caky-text rounded-tl-sm border border-caky-secondary/30'
        }`}
      >
        <div className={`prose ${isMobile ? 'prose-sm' : 'prose-sm md:prose-base'} max-w-none leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${isUser ? 'prose-invert' : ''} ${isMobile ? '[&_*]:text-sm' : ''}`}>
          {renderContent()}
        </div>
        <div
          className={`text-xs mt-2 text-right font-medium ${
            isUser ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })}
        </div>
      </div>
    </div>
  );
}