'use client';
import { useState, useEffect, useRef } from 'react';
import { Bot, User, Send, CheckCircle2, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

// Initialize lazily to avoid build-time crashes
const getSupabase = () => createClient();

export default function SocialInboxPage() {
    const supabase = getSupabase();
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [replyText, setReplyText] = useState('');
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchConversations();

        // Subscription to conversation updates
        const convSub = supabase
            .channel('social_conversations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'social_conversations' }, (payload) => {
                fetchConversations(false);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(convSub);
        };
    }, []);

    useEffect(() => {
        if (selectedConvId) {
            fetchMessages(selectedConvId);

            const msgSub = supabase
                .channel(`social_messages_${selectedConvId}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_messages', filter: `conversation_id=eq.${selectedConvId}` }, (payload) => {
                    setMessages(prev => [...prev, payload.new]);
                    scrollToBottom();
                })
                .subscribe();

            return () => { supabase.removeChannel(msgSub); };
        } else {
            setMessages([]);
        }
    }, [selectedConvId]);

    const fetchConversations = async (showLoading = true) => {
        if (showLoading) setLoadingConvs(true);
        const { data, error } = await supabase
            .from('social_conversations')
            .select('*')
            .order('last_message_at', { ascending: false });

        if (!error && data) setConversations(data);
        if (showLoading) setLoadingConvs(false);
    };

    const fetchMessages = async (convId: string) => {
        setLoadingMsgs(true);
        const { data, error } = await supabase
            .from('social_messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('sent_at', { ascending: true });

        if (!error && data) {
            setMessages(data);
            setTimeout(scrollToBottom, 100);
        }
        setLoadingMsgs(false);

        // Mark as read
        await supabase.from('social_conversations').update({ is_read: true }).eq('id', convId);
        fetchConversations(false); // background update to clear unread indicator
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!selectedConvId) return;

        // Fetch current user logic (simulated for now, real app uses session)
        const { data: { user } } = await supabase.auth.getUser();

        const updateData: any = { status: newStatus };
        if (newStatus === 'human_handling' && user) {
            updateData.assigned_to = user.id;
        }

        const { error } = await supabase.from('social_conversations').update(updateData).eq('id', selectedConvId);
        if (!error) {
            toast.success(`Статус змінено на: ${newStatus === 'ai_handling' ? 'AI' : newStatus === 'resolved' ? 'Вирішено' : 'Менеджер'}`);
            fetchConversations(false);
        } else {
            toast.error('Помилка оновлення статусу');
        }
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !selectedConvId) return;

        const text = replyText;
        setReplyText('');

        const conv = conversations.find(c => c.id === selectedConvId);
        if (!conv) return;

        // Note: In a real environment, you might hit a protected API endpoint (like POST /api/chatbot/reply) 
        // to securely talk to Telegram/Meta API instead of just updating DB.
        // For standard demonstration, we insert to DB, and a background worker/trigger or direct fetch call sends it.
        try {
            // First save to DB
            const { error: dbErr } = await supabase.from('social_messages').insert({
                conversation_id: selectedConvId,
                sender: 'human_manager',
                original_text: text
            });

            if (dbErr) throw dbErr;

            // Make sure status is human_handling
            if (conv.status !== 'human_handling') {
                await handleStatusChange('human_handling');
            }

            // Ideal scenario: Call Next.js API to pass via Telegram/Meta
            if (conv.platform === 'telegram') {
                await fetch('/api/chatbot/telegram/reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chatId: conv.external_user_id, text })
                });
            } else {
                await fetch('/api/chatbot/meta/reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipientId: conv.external_user_id, text })
                });
            }

        } catch (err: any) {
            console.error('Reply err:', err);
            toast.error('Не вдалось відправити повідомлення на платформу');
        }
    };

    const selectedConv = conversations.find(c => c.id === selectedConvId);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', height: 'calc(100vh - 120px)', backgroundColor: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>

            {/* Conversations List */}
            <div style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#1e293b' }}>
                        Соціальний Inbox
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Instagram, Facebook, Telegram</p>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loadingConvs ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" color="#94a3b8" /></div>
                    ) : conversations.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Немає активних розмов</div>
                    ) : (
                        conversations.map(conv => (
                            <div
                                key={conv.id}
                                onClick={() => setSelectedConvId(conv.id)}
                                style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', backgroundColor: selectedConvId === conv.id ? '#f8fafc' : 'white', borderLeft: selectedConvId === conv.id ? '4px solid var(--primary)' : '4px solid transparent', transition: 'all 0.2s' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: conv.is_read ? 600 : 800, color: '#1e293b' }}>
                                            {conv.external_username || conv.external_user_id}
                                        </span>
                                        {!conv.is_read && <div style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%' }}></div>}
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                                        backgroundColor: conv.status === 'ai_handling' ? '#dcfce7' : conv.status === 'needs_human' ? '#fee2e2' : conv.status === 'human_handling' ? '#e0e7ff' : '#f1f5f9',
                                        color: conv.status === 'ai_handling' ? '#166534' : conv.status === 'needs_human' ? '#991b1b' : conv.status === 'human_handling' ? '#3730a3' : '#475569'
                                    }}>
                                        {conv.platform === 'telegram' ? 'TG' : conv.platform === 'instagram' ? 'IG' : 'FB'} •
                                        {conv.status === 'ai_handling' ? ' AI' : conv.status === 'needs_human' ? ' Need Human' : conv.status === 'human_handling' ? ' Human' : ' Resolved'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Messages View */}
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
                {selectedConv ? (
                    <>
                        <div style={{ padding: '20px 24px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{selectedConv.external_username || selectedConv.external_user_id}</h3>
                                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>{selectedConv.platform}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {selectedConv.status !== 'human_handling' && (
                                    <button onClick={() => handleStatusChange('human_handling')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                                        <User size={16} /> Перебрати
                                    </button>
                                )}
                                {selectedConv.status !== 'ai_handling' && (
                                    <button onClick={() => handleStatusChange('ai_handling')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#dcfce7', color: '#166534', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                                        <Bot size={16} /> Віддати AI
                                    </button>
                                )}
                                {selectedConv.status !== 'resolved' && (
                                    <button onClick={() => handleStatusChange('resolved')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                                        <CheckCircle2 size={16} /> Вирішено
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {loadingMsgs ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="spin" color="#94a3b8" /></div>
                            ) : messages.map((m, idx) => {
                                const isCustomer = m.sender === 'customer';
                                const isAI = m.sender === 'ai';

                                return (
                                    <div key={m.id || idx} style={{ display: 'flex', justifyContent: isCustomer ? 'flex-start' : 'flex-end', alignItems: 'flex-end', gap: '8px' }}>
                                        {isCustomer && (
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <User size={16} color="#64748b" />
                                            </div>
                                        )}
                                        <div style={{
                                            maxWidth: '70%',
                                            padding: '12px 16px',
                                            borderRadius: '16px',
                                            borderBottomLeftRadius: isCustomer ? '4px' : '16px',
                                            borderBottomRightRadius: !isCustomer ? '4px' : '16px',
                                            backgroundColor: isCustomer ? 'white' : 'var(--primary)',
                                            color: isCustomer ? '#1e293b' : 'white',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                            border: isCustomer ? '1px solid #e2e8f0' : '1px solid var(--primary)'
                                        }}>
                                            <div style={{ fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.original_text}</div>
                                            <div style={{ fontSize: '11px', color: isCustomer ? '#94a3b8' : 'rgba(255,255,255,0.7)', marginTop: '4px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                {isAI && <Bot size={12} />}
                                                {!isAI && !isCustomer && <User size={12} />}
                                                {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div style={{ padding: '20px 24px', backgroundColor: 'white', borderTop: '1px solid #e2e8f0' }}>
                            {selectedConv.status === 'ai_handling' ? (
                                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', color: '#64748b', fontSize: '14px', border: '1px dashed #cbd5e1' }}>
                                    <Bot size={24} style={{ display: 'block', margin: '0 auto 8px', color: '#94a3b8' }} />
                                    AI зараз спілкується з клієнтом. Щоб відповісти вручну, натисніть "Перебрати".
                                </div>
                            ) : (
                                <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '12px' }}>
                                    <input
                                        type="text"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Напишіть повідомлення..."
                                        style={{ flex: 1, padding: '14px 20px', borderRadius: '100px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '15px' }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!replyText.trim()}
                                        style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: replyText.trim() ? 'var(--primary)' : '#e2e8f0', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: replyText.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                                    >
                                        <Send size={20} style={{ marginLeft: '2px' }} />
                                    </button>
                                </form>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <Bot size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                        <h3 style={{ margin: 0, fontWeight: 700, color: '#64748b' }}>Оберіть розмову</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '14px' }}>Усі чати агрегуються тут автоматично.</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
