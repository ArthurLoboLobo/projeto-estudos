import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { toast } from 'sonner';
import { getAuthToken } from '../lib/auth';
import { GET_SESSION, GET_TOPICS, GET_CHATS, GET_MESSAGES, GET_REVIEW_CHAT, GET_DOCUMENTS, GET_DOCUMENT_URL } from '../lib/graphql/queries';
import { SEND_MESSAGE, UPDATE_TOPIC_COMPLETION, DELETE_DOCUMENT } from '../lib/graphql/mutations';
import Header from '../components/Header';
import Markdown from '../components/ui/Markdown';
import type { Session as SessionType, Topic, Chat, Message, Document } from '../types';
import ProcessingStatusBadge from '../components/ProcessingStatusBadge';
import SessionUpload from './SessionUpload';
import SessionPlanning from './SessionPlanning';

const API_BASE = import.meta.env.VITE_GRAPHQL_ENDPOINT?.replace('/graphql', '') || 'http://localhost:8080';

export default function Session() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionType | null>(null);

  // Fetch session data
  const { data: sessionData, error: sessionError, refetch: refetchSession } = useQuery<{ session: SessionType }>(GET_SESSION, {
    variables: { id },
    skip: !id,
  });

  // Update local state when data changes
  useEffect(() => {
    if (sessionData?.session) {
      setSession(sessionData.session);
    }
  }, [sessionData]);

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

  // Route based on status
  if (session.status === 'PLANNING') {
    // If no draftPlan, show upload page
    if (!session.draftPlan || session.draftPlan.topics.length === 0) {
      return (
        <SessionUpload
          session={session}
          onPlanGenerated={(updatedSession) => {
            setSession(updatedSession);
            refetchSession();
          }}
        />
      );
    }
    // If draftPlan exists, show planning page
    return (
      <SessionPlanning
        session={session}
        onSessionUpdate={(updatedSession) => {
          setSession(updatedSession);
          refetchSession();
        }}
      />
    );
  }

  // ACTIVE or COMPLETED status - render the main study view
  return (
    <SessionStudying
      session={session}
      onSessionUpdate={(updatedSession) => {
        setSession(updatedSession);
        refetchSession();
      }}
    />
  );
}

// The main studying interface with topic cards
interface SessionStudyingProps {
  session: SessionType;
  onSessionUpdate: (session: SessionType) => void;
}

function SessionStudying({ session }: SessionStudyingProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showReviewChat, setShowReviewChat] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Document Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch topics
  const { data: topicsData, refetch: refetchTopics } = useQuery<{ topics: Topic[] }>(GET_TOPICS, {
    variables: { sessionId: session.id },
  });

  // Fetch chats
  const { data: chatsData } = useQuery<{ chats: Chat[] }>(GET_CHATS, {
    variables: { sessionId: session.id },
  });

  // Fetch review chat
  const { data: reviewChatData } = useQuery<{ reviewChat: Chat | null }>(GET_REVIEW_CHAT, {
    variables: { sessionId: session.id },
  });

  // Fetch documents
  const { data: documentsData, refetch: refetchDocs } = useQuery<{ documents: Document[] }>(GET_DOCUMENTS, {
    variables: { sessionId: session.id },
    pollInterval: 5000, // Poll for processing status
  });

  const [getDocumentUrl] = useLazyQuery<{ documentUrl: string }>(GET_DOCUMENT_URL);

  // Mutations
  const [updateTopicCompletion] = useMutation(UPDATE_TOPIC_COMPLETION);
  const [deleteDocument] = useMutation(DELETE_DOCUMENT);

  const topics: Topic[] = topicsData?.topics || [];
  const chats: Chat[] = chatsData?.chats || [];
  const reviewChat: Chat | null = reviewChatData?.reviewChat || null;
  const documents: Document[] = documentsData?.documents || [];

  const [isChatExpanded, setIsChatExpanded] = useState(false);

  // Get chat for a topic
  const getChatForTopic = (topicId: string): Chat | undefined => {
    return chats.find(c => c.topicId === topicId);
  };

  const handleTopicClick = (topic: Topic) => {
    const chat = getChatForTopic(topic.id);
    if (chat) {
      setSelectedTopicId(topic.id);
      setSelectedChatId(chat.id);
      setShowReviewChat(false);
      // Reset expansion state when opening new chat
      setIsChatExpanded(false);
    }
  };

  const handleReviewClick = () => {
    if (reviewChat) {
      setSelectedTopicId(null);
      setSelectedChatId(reviewChat.id);
      setShowReviewChat(true);
      setIsChatExpanded(false);
    }
  };

  const handleCloseChat = () => {
    setSelectedTopicId(null);
    setSelectedChatId(null);
    setShowReviewChat(false);
  };

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
        data = { error: text || 'Upload failed' };
      }

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      toast.success('Documento enviado! Processamento iniciado.');
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

  const handleViewDocument = async (doc: Document) => {
    if (doc.processingStatus !== 'COMPLETED') {
      toast.info('O documento ainda está sendo processado.');
      return;
    }

    try {
      const { data } = await getDocumentUrl({ variables: { id: doc.id } });
      if (data?.documentUrl) {
        window.open(data.documentUrl, '_blank');
      } else {
        toast.error('Não foi possível obter o link do documento.');
      }
    } catch (err: any) {
      console.error('Error fetching document URL:', err);
      toast.error('Erro ao abrir documento.');
    }
  };

  const handleToggleTopicCompletion = async (topic: Topic) => {
    try {
      await updateTopicCompletion({
        variables: { id: topic.id, isCompleted: !topic.isCompleted },
      });
      refetchTopics();
      toast.success(topic.isCompleted ? 'Tópico reaberto' : 'Tópico concluído!');
    } catch (err: any) {
      toast.error(err.message || 'Falha ao atualizar tópico');
    }
  };

  const completedCount = topics.filter(t => t.isCompleted).length;
  const progress = topics.length > 0 ? (completedCount / topics.length) * 100 : 0;

  const selectedTopic = selectedTopicId ? topics.find(t => t.id === selectedTopicId) || null : null;

  // Show topic cards
  return (
    <div className="min-h-screen bg-caky-bg relative">
      {/* Chat Overlay */}
      {selectedChatId && (
        <TopicChat
          chatId={selectedChatId}
          topic={selectedTopic}
          isReviewChat={showReviewChat}
          onClose={handleCloseChat}
          onTopicComplete={() => {
            if (selectedTopic) {
              handleToggleTopicCompletion(selectedTopic);
            }
          }}
          isMobile={isMobile}
          isExpanded={isChatExpanded}
          onToggleExpand={() => setIsChatExpanded(!isChatExpanded)}
        />
      )}

      {/* Document Modal Overlay */}
      {isDocModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsDocModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-caky-secondary/20 flex justify-between items-center bg-gradient-to-r from-caky-primary/5 to-caky-secondary/10">
              <div>
                <h2 className="text-xl font-bold text-caky-text">Seus Documentos</h2>
                <p className="text-sm text-caky-text/60">Gerencie os materiais de estudo desta sessão</p>
              </div>
              <button 
                onClick={() => setIsDocModalOpen(false)}
                className="p-2 hover:bg-black/5 rounded-lg text-caky-text/50 hover:text-caky-text transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* Upload Area */}
              <div className="mb-6">
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
                  className="w-full py-8 border-2 border-dashed border-caky-primary/40 hover:border-caky-primary bg-caky-primary/5 hover:bg-caky-primary/10 text-caky-primary hover:text-caky-text rounded-2xl transition flex flex-col items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-8 w-8 border-3 border-caky-primary border-t-transparent"></div>
                      <span className="font-semibold">{uploadProgress || 'Enviando...'}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="font-bold text-lg">Upload de Arquivos</span>
                      <span className="text-sm text-caky-text/50">Provas antigas, slides, anotações (máx. 50MB)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Document List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-caky-text/70 uppercase tracking-wide">Documentos Enviados</h3>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-caky-text/50 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Nenhum documento enviado ainda.
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-caky-primary/30 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                        <div 
                          onClick={() => handleViewDocument(doc)}
                          className="p-2 bg-white rounded-lg border border-gray-200 text-red-500 cursor-pointer hover:scale-105 transition shadow-sm"
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div 
                            onClick={() => handleViewDocument(doc)}
                            className="font-semibold text-caky-text truncate cursor-pointer hover:text-caky-primary transition"
                            title={doc.fileName}
                          >
                            {doc.fileName}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <ProcessingStatusBadge status={doc.processingStatus} />
                            <span className="text-xs text-gray-400">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                        className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                        title="Excluir"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Header
        sessionTitle={session.title}
        showBackButton={true}
      />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-caky-text">Progresso</h2>
            <span className="text-sm text-caky-text/60">{completedCount} de {topics.length} tópicos</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-caky-primary to-caky-secondary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Topic Cards List */}
          <div className="lg:col-span-2 flex flex-col gap-4 md:gap-6">
            {topics.map((topic, index) => {
              const chat = getChatForTopic(topic.id);
              const isStarted = chat?.isStarted || false;

              return (
                <div
                  key={topic.id}
                  onClick={() => handleTopicClick(topic)}
                  className={`relative bg-white rounded-2xl p-5 border-2 cursor-pointer transition-all hover:shadow-lg group ${
                    topic.isCompleted
                      ? 'border-green-300 bg-green-50/50'
                      : isStarted
                      ? 'border-caky-primary/50 hover:border-caky-primary'
                      : 'border-gray-200 hover:border-caky-primary/50'
                  }`}
                >
                  {/* Topic Number Badge */}
                  <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md ${
                    topic.isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-caky-primary text-white'
                  }`}>
                    {topic.isCompleted ? '✓' : index + 1}
                  </div>

                  {/* Complete Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTopicCompletion(topic);
                    }}
                    className="absolute top-4 right-4 group/checkbox select-none"
                    title={topic.isCompleted ? 'Reabrir tópico' : 'Marcar como concluído'}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                      topic.isCompleted
                        ? 'bg-green-500 border-green-500 shadow-sm shadow-green-200'
                        : 'bg-white border-gray-300 group-hover/checkbox:border-green-400'
                    }`}>
                      {topic.isCompleted && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  <div className="mt-2">
                    <h3 className={`font-bold text-lg mb-2 pr-10 ${topic.isCompleted ? 'text-green-700' : 'text-caky-text'}`}>
                      {topic.title}
                    </h3>
                    {topic.description && (
                      <p className={`text-sm line-clamp-2 ${topic.isCompleted ? 'text-green-600/70' : 'text-caky-text/60'}`}>
                        {topic.description}
                      </p>
                    )}
                  </div>

                  {/* Status Indicator */}
                  <div className="mt-4 flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      topic.isCompleted
                        ? 'bg-green-100 text-green-700'
                        : isStarted
                        ? 'bg-caky-primary/10 text-caky-primary'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {topic.isCompleted ? 'Concluído' : isStarted ? 'Em progresso' : 'Não iniciado'}
                    </span>
                    <svg className="w-5 h-5 text-caky-text/30 group-hover:text-caky-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Actions */}
          <div className="lg:col-span-1 space-y-4">
            {/* Documentos Card */}
            <div
              onClick={() => setIsDocModalOpen(true)}
              className="bg-[#3B4C84] rounded-2xl p-6 cursor-pointer hover:shadow-xl transition-all text-white group"
            >
              <div className="mb-4">
                <svg className="w-8 h-8 text-white/80 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-xl mb-2">Documentos</h3>
              <p className="text-white/70 text-sm">
                Veja os documentos eviados e envie novos.
              </p>
            </div>

            {/* Review Chat Card */}
            {reviewChat && (
              <div
                onClick={handleReviewClick}
                className="bg-[#3B4C84] rounded-2xl p-6 cursor-pointer hover:shadow-xl transition-all text-white group"
              >
                <div className="mb-4">
                  <svg className="w-8 h-8 text-white/80 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="font-bold text-xl mb-2">Revisão Geral</h3>
                <p className="text-white/70 text-sm">
                  Revise os conteúdos de cada tópico e pratique com exercícios.
                </p>
              </div>
            )}

            {/* Simulados Card */}
            <div
              className="bg-[#3B4C84] rounded-2xl p-6 cursor-not-allowed text-white opacity-80"
            >
              <div className="mb-4">
                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-xl mb-2">Simulados</h3>
                  <p className="text-white/70 text-sm">
                    Monte simulados personalizados para praticar.
                  </p>
                </div>
                <span className="bg-white/20 text-white text-[10px] px-5 py-1 rounded-full font-bold uppercase tracking-wide whitespace-nowrap">
                  Em breve
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Topic-specific chat interface
interface TopicChatProps {
  chatId: string;
  topic: Topic | null;
  isReviewChat: boolean;
  onClose: () => void;
  onTopicComplete: () => void;
  isMobile: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function TopicChat({ 
  chatId, 
  topic, 
  isReviewChat, 
  onClose, 
  onTopicComplete, 
  isMobile, 
  isExpanded,
  onToggleExpand
}: TopicChatProps) {
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch messages
  const { data: messagesData, loading: loadingMessages, refetch: refetchMessages } = useQuery<{ messages: Message[] }>(GET_MESSAGES, {
    variables: { chatId },
  });

  // Mutations
  const [sendMessage, { loading: sending }] = useMutation<{ sendMessage: Message }>(SEND_MESSAGE);

  const serverMessages: Message[] = messagesData?.messages || [];
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [aiTyping, setAiTyping] = useState(false);
  const messages: Message[] = [...serverMessages, ...optimisticMessages];

  // Poll for messages while they're being generated in the background
  const isWaitingForWelcome = !loadingMessages && serverMessages.length === 0;
  
  useEffect(() => {
    if (isWaitingForWelcome) {
      // Poll every 1 second while waiting for the welcome message
      const interval = setInterval(() => {
        refetchMessages();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isWaitingForWelcome, refetchMessages]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending) return;

    const content = messageInput.trim();
    setMessageInput('');

    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto';
    }

    const optimisticMessage: Message = {
      id: `optimistic-${Date.now()}`,
      chatId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    setOptimisticMessages([optimisticMessage]);
    setAiTyping(true);

    try {
      await sendMessage({
        variables: { chatId, content },
        onCompleted: () => {
          refetchMessages();
          setOptimisticMessages([]);
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

  const chatTitle = isReviewChat ? 'Revisão Geral' : topic?.title || 'Chat';

  // Determine popup styles based on expansion state
  const popupStyles = isExpanded 
    ? "fixed top-[74px] left-0 right-0 bottom-0 z-40 bg-white shadow-2xl flex flex-col transition-all duration-300"
    : "fixed top-[10%] bottom-[5%] left-[5%] right-[5%] md:left-[15%] md:right-[15%] lg:left-[20%] lg:right-[20%] z-40 bg-white shadow-2xl rounded-2xl border border-gray-200 flex flex-col transition-all duration-300";

  return (
    <>
      {/* Backdrop for non-expanded mode */}
      {!isExpanded && (
        <div className="fixed inset-0 bg-black/20 z-30 backdrop-blur-sm" onClick={onClose} />
      )}
      
      <div className={popupStyles}>
        {/* Chat Header */}
        <header className={`border-b border-caky-text/10 bg-white shrink-0 z-10 px-4 py-3 flex items-center justify-between ${!isExpanded ? 'rounded-t-2xl' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-bold text-caky-text truncate">{chatTitle}</h1>
          </div>

          <div className="flex items-center gap-2">
            {topic && (
              <label className="flex items-center gap-2 cursor-pointer group/chat-checkbox select-none mr-2 hidden md:flex">
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                  topic.isCompleted
                    ? 'bg-green-500 border-green-500 shadow-sm shadow-green-200'
                    : 'bg-white border-gray-300 group-hover/chat-checkbox:border-green-400'
                }`}>
                  {topic.isCompleted && (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={topic.isCompleted}
                  onChange={onTopicComplete}
                />
                <span className={`text-sm font-medium ${topic.isCompleted ? 'text-green-700' : 'text-caky-text/70'}`}>
                  {topic.isCompleted ? 'Concluído' : 'Marcar Concluído'}
                </span>
              </label>
            )}
            
            {/* Expand/Collapse Button */}
            <button
              onClick={onToggleExpand}
              className="p-2 text-caky-text/70 hover:text-caky-text hover:bg-caky-secondary/20 rounded-lg transition active:scale-95"
              title={isExpanded ? "Reduzir" : "Expandir"}
            >
              {isExpanded ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-caky-text/70 hover:text-red-500 hover:bg-red-50 rounded-lg transition active:scale-95"
              title="Fechar Chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 relative min-h-0">
          <div
            className="absolute inset-0 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 bg-caky-bg scroll-smooth"
            style={isMobile ? { WebkitOverflowScrolling: 'touch' } : {}}
          >
          <div className="max-w-3xl mx-auto w-full">
            {loadingMessages && messages.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-caky-primary border-t-transparent"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-full text-center px-4 py-12">
                {/* Show typing indicator while waiting for welcome message */}
                <div className="flex justify-start w-full mb-4">
                  <div className={`max-w-[85%] md:max-w-2xl rounded-2xl ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} bg-white text-caky-text rounded-tl-none border border-caky-secondary/30 shadow-sm`}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-caky-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-caky-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-caky-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-sm text-caky-text/50 font-medium">Caky está preparando sua aula...</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} isMobile={isMobile} />
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
      </div>

      {/* Message Input */}
      <div className={`border-t border-caky-text/10 bg-white ${isMobile ? 'p-3 pb-safe' : 'p-3 md:p-4'} shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] ${!isExpanded ? 'rounded-b-2xl' : ''}`}>
        <form onSubmit={handleSendMessage} className={`flex ${isMobile ? 'gap-3' : 'gap-2 md:gap-3'} max-w-5xl mx-auto`}>
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
            placeholder={isMobile ? "Pergunte..." : "Pergunte qualquer coisa..."}
            className={`flex-1 ${isMobile ? 'px-4 py-3 min-h-[56px]' : 'px-3 md:px-4 py-2 md:py-3'} bg-gray-50 dark:bg-caky-card/50 border border-gray-200 dark:border-gray-600 rounded-xl text-caky-text placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary ${isMobile ? 'text-base resize-none' : 'text-sm md:text-base'} transition resize-none`}
            disabled={sending}
            autoComplete="off"
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
            }}
          />
          <button
            type="submit"
            disabled={sending || !messageInput.trim()}
            className={`${isMobile ? 'px-5 py-3 min-h-[44px]' : 'px-4 md:px-6 py-2 md:py-3'} bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-primary transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${isMobile ? 'text-base active:scale-95' : 'text-sm md:text-base'} shadow-md`}
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
      </div>
    </>
  );
}

interface MessageBubbleProps {
  message: Message;
  isMobile: boolean;
}

function MessageBubble({ message, isMobile }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const renderContent = () => {
    if (isUser) {
      return (
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>
      );
    } else {
      return (
        <Markdown isUserMessage={false} isMobile={isMobile}>
          {message.content}
        </Markdown>
      );
    }
  };

  return (
    <div className={`flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'} ${isMobile ? 'mb-4 px-1' : 'mb-4'}`}>
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
