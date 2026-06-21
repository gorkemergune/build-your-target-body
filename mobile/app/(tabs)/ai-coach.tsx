import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius } from "../../src/constants/colors";
import { sendMessage, getConversations, clearConversations } from "../../src/api/ai";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color={Colors.white} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.content}</Text>
      </View>
    </View>
  );
}

export default function AiCoachScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConversations();
      if (Array.isArray(data) && data.length > 0) {
        const msgs: Message[] = data.flatMap((turn: any, i: number) => {
          const result: Message[] = [];
          if (turn.user_message) result.push({ id: `u-${i}`, role: "user", content: turn.user_message });
          if (turn.ai_response) result.push({ id: `a-${i}`, role: "assistant", content: turn.ai_response });
          return result;
        });
        setMessages(msgs);
      } else {
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: "Hi! I'm your AI fitness coach. Ask me anything about your training, nutrition, or progress.",
        }]);
      }
    } catch {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hi! I'm your AI fitness coach. Ask me anything about your training, nutrition, or progress.",
      }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const response = await sendMessage(text);
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: response.message ?? response.response ?? "Sorry, I didn't get that.",
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    try {
      await clearConversations();
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Chat cleared. What can I help you with?",
      }]);
    } catch { }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.coachAvatar}>
            <Ionicons name="sparkles" size={18} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.title}>AI Coach</Text>
            <Text style={styles.subtitle}>Powered by Gemini</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Suggested prompts (only if no real messages yet) */}
        {messages.length === 1 && messages[0].id === "welcome" && (
          <View style={styles.suggestions}>
            {[
              "What should I eat to build muscle?",
              "How many rest days do I need?",
              "Analyze my recent workouts",
            ].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => { setInput(s); }}
                style={styles.suggestionChip}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask your AI coach..."
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.card },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  coachAvatar: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: Colors.text },
  subtitle: { fontSize: 11, color: Colors.textMuted },

  messageList: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },

  bubbleWrap: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.xs, marginBottom: Spacing.sm },
  bubbleWrapUser: { flexDirection: "row-reverse" },
  avatar: {
    width: 28, height: 28, borderRadius: 10, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  bubble: {
    maxWidth: "80%", borderRadius: Radius.lg, padding: Spacing.sm + 2,
    backgroundColor: Colors.white, shadowColor: "#000", shadowOpacity: 0.04,
    shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  bubbleUser: {
    backgroundColor: Colors.primary, shadowOpacity: 0,
  },
  bubbleText: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  bubbleTextUser: { color: Colors.white },

  suggestions: { padding: Spacing.md, gap: Spacing.xs },
  suggestionChip: {
    alignSelf: "flex-start", backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  suggestionText: { fontSize: 13, fontWeight: "500", color: Colors.primary },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm,
    padding: Spacing.sm, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, fontSize: 15, color: Colors.text, minHeight: 40, maxHeight: 120,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10, lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: Colors.border },
});
