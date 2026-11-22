import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';

interface Message { role: 'user' | 'assistant'; content: string; loading?: boolean }

const STARTERS = [
  'What should I do next?',
  'How do I add a customer?',
  'Show me overdue invoices',
  'Help me run payroll',
  'Explain inventory management',
];

export default function AIAssistantScreen() {
  const { tenant } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m NetOn AI. Ask me anything about your business — finances, inventory, HR, CRM, and more.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const tenantId = tenant?.id ?? '';

  const send = async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || sending) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: q };
    const loadingMsg: Message = { role: 'assistant', content: '', loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const d = await gql<any>(
        `mutation($t:UUID!,$q:String!,$c:UUID){ askNetonAi(tenantId:$t, question:$q, conversationId:$c) }`,
        { t: tenantId, q, c: conversationId ?? undefined }
      );
      // The server answers {answer, conversationId, unavailable}. Older builds read "reply", which is never sent.
      let raw: any = d?.askNetonAi;
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = { answer: raw }; } }
      let reply = String(raw?.answer ?? raw?.reply ?? raw?.message ?? '');
      let newConvId = raw?.conversationId || conversationId;
      if (raw?.unavailable && !reply) reply = 'The AI assistant is not switched on for your company yet.';
      if (newConvId && newConvId !== conversationId) setConversationId(newConvId);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: reply || 'I couldn\'t get a response. Please try again.' };
        return updated;
      });
    } catch (e: any) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Error: ' + (e?.message || 'Something went wrong.') };
        return updated;
      });
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.aiIcon}><Ionicons name="sparkles" size={18} color={GOLD} /></View>
          <View>
            <Text style={s.headerTitle}>NetOn AI</Text>
            <Text style={s.headerSub}>Your business assistant</Text>
          </View>
          <TouchableOpacity
            style={s.newBtn}
            onPress={() => { setMessages([{ role: 'assistant', content: 'Hi! I\'m NetOn AI. Ask me anything about your business.' }]); setConversationId(null); }}
          >
            <Ionicons name="add-circle-outline" size={20} color={NAVY} />
            <Text style={s.newBtnTxt}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Starter prompts */}
        {messages.length <= 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.starterBar} contentContainerStyle={s.starterRow}>
            {STARTERS.map(st => (
              <TouchableOpacity key={st} style={s.starterChip} onPress={() => send(st)}>
                <Text style={s.starterTxt}>{st}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Messages */}
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.msgList} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {messages.map((m, i) => (
            <View key={i} style={[s.bubble, m.role === 'user' ? s.userBubble : s.aiBubble]}>
              {m.loading ? (
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={GOLD} />
                  <Text style={s.aiText}>Thinking…</Text>
                </View>
              ) : (
                <Text style={m.role === 'user' ? s.userText : s.aiText}>{m.content}</Text>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Ask NetOn AI anything…"
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]} onPress={() => send()} disabled={!input.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  aiIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: NAVY },
  headerSub: { fontSize: 11, color: '#94A3B8' },
  newBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  newBtnTxt: { fontSize: 12, color: NAVY, fontWeight: '600' },
  starterBar: { maxHeight: 50 },
  starterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  starterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: NAVY + '11', borderWidth: 1, borderColor: NAVY + '33' },
  starterTxt: { fontSize: 12, color: NAVY, fontWeight: '500' },
  msgList: { padding: 16, gap: 10 },
  bubble: { maxWidth: '85%', borderRadius: 14, padding: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: NAVY },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  userText: { fontSize: 14, color: '#fff', lineHeight: 20 },
  aiText: { fontSize: 14, color: '#1E293B', lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  input: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1E293B', maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
