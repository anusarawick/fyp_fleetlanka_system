import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Building2, Check, CheckCheck, ChevronLeft, ChevronRight, MessageCircle, Minus, Search, Send, Sparkles, X } from "lucide-react";
import { apiGet, apiPost } from "../services/api";
import { useFeedback } from "../context/FeedbackContext";

export type ChatRequest =
  | { nonce: number; kind: "service_center"; id?: string }
  | { nonce: number; kind: "booking"; id?: string };

type ChatConversation = {
  id: string;
  service_center_id: string;
  service_booking_id?: string;
  conversation_type: string;
  service_center_name?: string;
  booking_vehicle_plate?: string;
  booking_reference?: string;
  last_message_text?: string;
  last_message_at?: string;
  unread_count: number;
};

type ChatMessage = {
  id: string;
  sender_role: string;
  sender_name?: string;
  message_text: string;
  created_at: string;
  read_by_recipient?: boolean;
  read_at?: string;
  pending?: boolean;
};

type ChatServiceCenter = {
  id: string;
  name: string;
  profile_id?: string;
  phone?: string;
  address?: string;
};

type AiTable = {
  columns: string[];
  rows: Array<Array<string | number | null>>;
};

type AiMessage = {
  role: "user" | "assistant";
  text: string;
  type?: string;
  title?: string | null;
  summary?: string | null;
  table?: AiTable | null;
  bullets?: string[];
  followups?: string[];
  refusal?: string | null;
};

type AiChatResponse = {
  answer: string;
  type?: string;
  title?: string | null;
  summary?: string | null;
  table?: AiTable | null;
  bullets?: string[];
  followups?: string[];
  refusal?: string | null;
};

type ChatPanelProps = {
  token?: string;
  role: "manager" | "service";
  request?: ChatRequest | null;
  onRequestHandled?: () => void;
};

const ASSISTANT_DRAWER_EVENT = "fleetlanka-assistant-drawer";
const ASSISTANT_DRAWER_KEY = "fleetlanka-assistant-drawer-open";
const ASSISTANT_ACTIVE_EVENT = "fleetlanka-assistant-active-tool";
type AssistantActiveTool = "chat" | "ai" | null;

function readAssistantDrawerOpen() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ASSISTANT_DRAWER_KEY) === "true";
}

function setAssistantDrawerOpen(open: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ASSISTANT_DRAWER_KEY, open ? "true" : "false");
  window.dispatchEvent(new CustomEvent(ASSISTANT_DRAWER_EVENT, { detail: open }));
}

function useAssistantDrawerOpen() {
  const [drawerOpen, setDrawerOpen] = useState(readAssistantDrawerOpen);

  useEffect(() => {
    const listener = (event: Event) => setDrawerOpen(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(ASSISTANT_DRAWER_EVENT, listener);
    return () => window.removeEventListener(ASSISTANT_DRAWER_EVENT, listener);
  }, []);

  return [drawerOpen, setAssistantDrawerOpen] as const;
}

function setAssistantActiveTool(tool: AssistantActiveTool) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASSISTANT_ACTIVE_EVENT, { detail: tool }));
}

function useAssistantActiveTool() {
  const [activeTool, setActiveTool] = useState<AssistantActiveTool>(null);

  useEffect(() => {
    const listener = (event: Event) => setActiveTool((event as CustomEvent<AssistantActiveTool>).detail || null);
    window.addEventListener(ASSISTANT_ACTIVE_EVENT, listener);
    return () => window.removeEventListener(ASSISTANT_ACTIVE_EVENT, listener);
  }, []);

  return [activeTool, setAssistantActiveTool] as const;
}

function useMinimizeOnOutsideClick(open: boolean, rootRef: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;
    const listener = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setAssistantActiveTool(null);
    };
    window.addEventListener("pointerdown", listener);
    return () => window.removeEventListener("pointerdown", listener);
  }, [open, rootRef]);
}

function titleFor(conversation?: ChatConversation | null) {
  if (!conversation) return "Messages";
  return conversation.service_center_name || "Service center";
}

function conversationTypeLabel(conversation: ChatConversation) {
  return conversation.conversation_type === "booking" ? conversation.booking_reference || "Booking" : "General";
}

function formatMessageTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function messageDateKey(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function renderAiText(text: string) {
  const lines = text.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let tableRows: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {listItems.map((item, index) => <li key={`${item}-${index}`}>{renderInlineText(item)}</li>)}
      </ul>
    );
    listItems = [];
  };

  const flushTable = () => {
    if (tableRows.length < 2) {
      tableRows.forEach((row) => nodes.push(<p key={`p-${nodes.length}`}>{renderInlineText(row)}</p>));
      tableRows = [];
      return;
    }
    const rows = tableRows.filter((row) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(row));
    const cells = rows.map((row) => row.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
    const [head, ...body] = cells;
    nodes.push(
      <div className="ai-assistant__table-wrap" key={`table-${nodes.length}`}>
        <table>
          <thead><tr>{head.map((cell, index) => <th key={`${cell}-${index}`}>{renderInlineText(cell)}</th>)}</tr></thead>
          <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={`${cell}-${index}`}>{renderInlineText(cell)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) {
      const nextNonEmpty = lines.slice(lineIndex + 1).find((nextLine) => nextLine.trim());
      if (tableRows.length > 0 && nextNonEmpty?.trim().startsWith("|")) {
        return;
      }
      flushList();
      flushTable();
      return;
    }
    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      flushList();
      tableRows.push(trimmed);
      return;
    }
    flushTable();
    const bullet = trimmed.match(/^[-*]\s+(.+)/) || trimmed.match(/^\d+[.)]\s+(.+)/);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }
    flushList();
    const heading = trimmed.match(/^#{2,4}\s+(.+)/);
    if (heading) {
      nodes.push(<strong className="ai-assistant__heading" key={`h-${nodes.length}`}>{renderInlineText(heading[1])}</strong>);
      return;
    }
    nodes.push(<p key={`p-${nodes.length}`}>{renderInlineText(trimmed)}</p>);
  });
  flushList();
  flushTable();
  return nodes.length ? nodes : text;
}

function renderInlineText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function messageForHistory(message: AiMessage) {
  if (!message.followups?.length) return message.text;
  const followups = message.followups.map((item, index) => `${index + 1}. ${item}`).join("\n");
  return `${message.text}\nFollow-ups:\n${followups}`;
}

function renderStructuredAiMessage(message: AiMessage, onFollowup: (prompt: string) => void) {
  const hasStructuredContent = message.title || message.summary || message.table || message.bullets?.length || message.followups?.length || message.refusal;
  if (!hasStructuredContent) return renderAiText(message.text);
  return (
    <div className="ai-assistant__structured">
      {message.title && <strong className="ai-assistant__heading">{message.title}</strong>}
      {(message.refusal || message.summary) && <p>{message.refusal || message.summary}</p>}
      {!!message.bullets?.length && (
        <ul>
          {message.bullets.map((item, index) => <li key={`${item}-${index}`}>{renderInlineText(item)}</li>)}
        </ul>
      )}
      {message.table?.columns?.length && (
        <div className="ai-assistant__table-wrap">
          <table>
            <thead>
              <tr>{message.table.columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {message.table.rows.length ? (
                message.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {message.table?.columns.map((column, cellIndex) => (
                      <td key={`${column}-${cellIndex}`}>{row[cellIndex] ?? "--"}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr><td colSpan={message.table.columns.length}>No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!!message.followups?.length && (
        <div className="ai-assistant__followups" aria-label="Suggested follow-ups">
          {message.followups.slice(0, 4).map((followup) => (
            <button type="button" key={followup} onClick={() => onFollowup(followup)}>
              {followup}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({ token, role, request, onRequestHandled }: ChatPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const feedback = useFeedback();
  const [drawerOpen, setDrawerOpen] = useAssistantDrawerOpen();
  const [activeTool, setActiveTool] = useAssistantActiveTool();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [serviceCenters, setServiceCenters] = useState<ChatServiceCenter[]>([]);
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [showStart, setShowStart] = useState(false);
  const [loading, setLoading] = useState(false);
  const base = role === "service" ? "/service-portal/chat" : "/chat";
  const open = activeTool === "chat";
  const unreadTotal = useMemo(() => conversations.reduce((sum, row) => sum + (row.unread_count || 0), 0), [conversations]);
  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => {
      return [
        conversation.service_center_name,
        conversation.booking_reference,
        conversation.booking_vehicle_plate,
        conversation.last_message_text,
        conversation.conversation_type === "booking" ? "booking" : "general",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [conversationSearch, conversations]);
  useMinimizeOnOutsideClick(open, rootRef);

  async function loadConversations() {
    if (!token) return;
    const rows = await apiGet<ChatConversation[]>(`${base}/conversations`, token);
    setConversations(rows);
    setSelected((current) => {
      if (!current) return current;
      return rows.find((row) => row.id === current.id) || current;
    });
  }

  async function loadServiceCenters() {
    if (!token || role !== "manager") return;
    const rows = await apiGet<ChatServiceCenter[]>("/chat/service-centers", token);
    setServiceCenters(rows);
  }

  async function loadMessages(conversationId: string) {
    if (!token) return;
    const rows = await apiGet<ChatMessage[]>(`${base}/conversations/${conversationId}/messages`, token);
    setMessages(rows);
    await apiPost(`${base}/conversations/${conversationId}/read`, {}, token);
    await loadConversations();
  }

  async function openConversation(conversation: ChatConversation) {
    setSelected(conversation);
    setActiveTool("chat");
    setDrawerOpen(true);
    await loadMessages(conversation.id);
  }

  async function openTarget(nextRequest: ChatRequest) {
    if (!token) return;
    setLoading(true);
    try {
      const path =
        nextRequest.kind === "booking"
          ? `${base}/conversations/booking`
          : `${base}/conversations/service-center`;
      const payload =
        nextRequest.kind === "booking"
          ? { service_booking_id: nextRequest.id }
          : role === "service"
            ? {}
            : { service_center_id: nextRequest.id };
      const conversation = await apiPost<ChatConversation>(path, payload, token);
      setShowStart(false);
      await openConversation(conversation);
      await loadConversations();
    } catch (err: any) {
      setActiveTool("chat");
      setDrawerOpen(true);
      feedback.error("Chat open failed", err.message || "Failed to open chat");
    } finally {
      setLoading(false);
      onRequestHandled?.();
    }
  }

  async function handleStartToggle() {
    if (role === "service") {
      await openTarget({ nonce: Date.now(), kind: "service_center" });
      return;
    }
    setShowStart((value) => !value);
    if (serviceCenters.length === 0) {
      loadServiceCenters().catch((err: any) => feedback.error("Service centers unavailable", err.message || "Failed to load service centers"));
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!token || !selected || !messageText.trim()) return;
    const text = messageText.trim();
    const pendingId = `pending-${Date.now()}`;
    const pendingMessage: ChatMessage = {
      id: pendingId,
      sender_role: role,
      sender_name: role === "service" ? "Service center" : "You",
      message_text: text,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessageText("");
    setMessages((current) => [...current, pendingMessage]);
    try {
      const savedMessage = await apiPost<ChatMessage>(`${base}/conversations/${selected.id}/messages`, { message_text: text }, token);
      setMessages((current) => current.map((message) => (message.id === pendingId ? savedMessage : message)));
      loadConversations().catch(() => undefined);
    } catch (err: any) {
      setMessages((current) => current.filter((message) => message.id !== pendingId));
      feedback.error("Message failed", err.message || "Failed to send message");
    }
  }

  useEffect(() => {
    if (!token || !drawerOpen) return;
    loadConversations().catch(() => undefined);
    const id = window.setInterval(() => {
      loadConversations().catch(() => undefined);
      if (selected && open) loadMessages(selected.id).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(id);
  }, [token, selected?.id, base, drawerOpen, open]);

  useEffect(() => {
    if (!request) return;
    setDrawerOpen(true);
    openTarget(request);
  }, [request?.nonce]);

  useEffect(() => {
    if (!open) return;
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, selected?.id, open]);

  if (!drawerOpen) {
    return (
      <button className="assistant-drawer-toggle assistant-drawer-toggle--closed" type="button" onClick={() => setDrawerOpen(true)} aria-label="Show chat and AI tools">
        <ChevronLeft aria-hidden="true" />
        {unreadTotal > 0 && <span>{unreadTotal}</span>}
      </button>
    );
  }

  return (
    <div className={`chat-panel${open ? " chat-panel--open" : ""}`} ref={rootRef}>
      {open && (
        <section className="chat-panel__window" aria-label="Messages">
          <header className="chat-panel__header">
            <div className="chat-panel__title">
              <div>
                <strong>{titleFor(selected)}</strong>
              </div>
              {selected ? (
                <span className="chat-panel__header-tags">
                  {selected.conversation_type === "booking" && (
                    <em className="chat-panel__header-tag is-plate">{selected.booking_vehicle_plate || "Vehicle not linked"}</em>
                  )}
                  <em className="chat-panel__header-tag">{conversationTypeLabel(selected)}</em>
                  <em className="chat-panel__header-tag is-muted">
                    {selected.conversation_type === "booking" ? "Booking chat" : "General chat"}
                  </em>
                </span>
              ) : (
                <span>Select or start a conversation</span>
              )}
            </div>
            <div className="chat-panel__header-actions">
              <button type="button" onClick={() => setActiveTool(null)} aria-label="Minimize chat">
                <Minus aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setActiveTool(null)} aria-label="Close chat">
                <X aria-hidden="true" />
              </button>
            </div>
          </header>
          <div className="chat-panel__body">
            <aside className="chat-panel__list">
              <button className="chat-panel__new" type="button" onClick={handleStartToggle} disabled={loading}>
                <Building2 aria-hidden="true" />
                <span>{role === "service" ? "Message manager" : "New service chat"}</span>
              </button>
              {role === "manager" && showStart && (
                <div className="chat-panel__start-list">
                  {serviceCenters.length === 0 ? (
                    <p>No service portals available.</p>
                  ) : serviceCenters.map((center) => (
                    <button
                      key={center.id}
                      className="chat-panel__center-option"
                      type="button"
                      onClick={() => openTarget({ nonce: Date.now(), kind: "service_center", id: center.id })}
                    >
                      <strong>{center.name}</strong>
                      <span>Service portal enabled</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="chat-panel__section-label">Conversations</div>
              <label className="chat-panel__search">
                <Search aria-hidden="true" />
                <input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search chats..." />
              </label>
              {conversations.length === 0 ? (
                <p>No conversations yet.</p>
              ) : filteredConversations.length === 0 ? (
                <p>No chats match your search.</p>
              ) : filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  className={`chat-panel__conversation${selected?.id === conversation.id ? " is-active" : ""}`}
                  type="button"
                  onClick={() => openConversation(conversation)}
                >
                  <div className="chat-panel__conversation-head">
                    <strong>{conversation.service_center_name || "Service center"}</strong>
                    <span className="chat-panel__conversation-tags">
                      {conversation.conversation_type === "booking" && (
                        <small>{conversation.booking_vehicle_plate || "Vehicle not linked"}</small>
                      )}
                      <em>{conversationTypeLabel(conversation)}</em>
                    </span>
                  </div>
                  <span>{conversation.last_message_text || "No messages yet"}</span>
                  {conversation.unread_count > 0 && <b>{conversation.unread_count}</b>}
                </button>
              ))}
            </aside>
            <main className="chat-panel__messages">
              {!selected ? (
                <div className="chat-panel__empty">
                  <MessageCircle aria-hidden="true" />
                  <strong>Start from a service portal or booking.</strong>
                  <span>General chats stay separate from booking-specific conversations.</span>
                </div>
              ) : (
                <>
                  <div className="chat-panel__message-list" ref={messageListRef}>
                    {messages.length === 0 && <div className="chat-panel__empty-inline">No messages in this conversation yet.</div>}
                    {messages.map((message, index) => {
                      const showDate = messageDateKey(message.created_at) !== messageDateKey(messages[index - 1]?.created_at);
                      return (
                        <div className="chat-panel__message-group" key={message.id}>
                          {showDate && <div className="chat-panel__date-separator">{formatMessageDate(message.created_at)}</div>}
                          <div
                            className={`chat-panel__message ${message.sender_role === role || (role === "manager" && message.sender_role !== "service") ? "is-own" : ""}`}
                          >
                            <span>{message.sender_name || message.sender_role}</span>
                            <p>
                              {message.message_text}
                              <small className="chat-panel__message-meta">
                                {formatMessageTime(message.created_at)}
                                {(message.sender_role === role || (role === "manager" && message.sender_role !== "service")) && (
                                  message.read_by_recipient ? <CheckCheck aria-label="Read" /> : <Check aria-label={message.pending ? "Sending" : "Sent"} />
                                )}
                              </small>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <form className="chat-panel__composer" onSubmit={sendMessage}>
                    <input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Type a message..." />
                    <button type="submit" disabled={loading || !messageText.trim()}><Send aria-hidden="true" /></button>
                  </form>
                </>
              )}
            </main>
          </div>
        </section>
      )}
      {!activeTool && (
        <div className="assistant-launcher-stack">
          <button className="chat-panel__launcher" type="button" onClick={() => setActiveTool("chat")}>
            <MessageCircle aria-hidden="true" />
            <span className="assistant-launcher-label">Chat</span>
            {unreadTotal > 0 && <b>{unreadTotal}</b>}
          </button>
          <button className="assistant-drawer-toggle assistant-drawer-toggle--open" type="button" onClick={() => { setActiveTool(null); setDrawerOpen(false); }} aria-label="Hide chat and AI tools">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export function AiAssistant({ token }: { token?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const aiMessageListRef = useRef<HTMLDivElement>(null);
  const feedback = useFeedback();
  const [drawerOpen] = useAssistantDrawerOpen();
  const [activeTool, setActiveTool] = useAssistantActiveTool();
  const [messages, setMessages] = useState<AiMessage[]>([
    { role: "assistant", text: "Ask me about your fleet, maintenance, fuel, documents, bookings, payments, or compliance." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const open = activeTool === "ai";
  useMinimizeOnOutsideClick(open, rootRef);

  useEffect(() => {
    if (!open || !aiMessageListRef.current) return;
    aiMessageListRef.current.scrollTo({
      top: aiMessageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, open]);

  async function sendPrompt(question: string) {
    if (!token || !question.trim()) return;
    const trimmedQuestion = question.trim();
    setMessages((prev) => [...prev, { role: "user", text: trimmedQuestion }]);
    setLoading(true);
    try {
      const history = messages.slice(-8).map((message) => ({ role: message.role, text: messageForHistory(message) }));
      const response = await apiPost<AiChatResponse>("/ai/chat", { message: trimmedQuestion, history }, token);
      setMessages((prev) => [...prev, {
        role: "assistant",
        text: response.answer,
        type: response.type,
        title: response.title,
        summary: response.summary,
        table: response.table,
        bullets: response.bullets,
        followups: response.followups,
        refusal: response.refusal,
      }]);
      if (response.answer.toLowerCase().includes("ai is busy")) {
        feedback.info("AI busy", "Please try again in a moment.");
      }
    } catch (err: any) {
      const message = err.message || "AI assistant failed.";
      setMessages((prev) => [...prev, { role: "assistant", text: message }]);
      feedback.error("AI assistant failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    const question = input.trim();
    setInput("");
    await sendPrompt(question);
  }

  if (!drawerOpen) return null;

  return (
    <div className={`ai-assistant${open ? " ai-assistant--open" : ""}`} ref={rootRef}>
      {open && (
        <section className="ai-assistant__window" aria-label="FleetLanka AI assistant">
          <header className="ai-assistant__header">
            <div className="ai-assistant__title">
              <strong>FleetLanka AI</strong>
              <span>Manager assistant</span>
            </div>
            <div className="ai-assistant__header-actions">
              <button type="button" onClick={() => setActiveTool(null)} aria-label="Minimize AI assistant"><Minus aria-hidden="true" /></button>
              <button type="button" onClick={() => setActiveTool(null)} aria-label="Close AI assistant"><X aria-hidden="true" /></button>
            </div>
          </header>
          <div className="ai-assistant__messages" ref={aiMessageListRef}>
            {messages.map((message, index) => (
              <div className={`ai-assistant__message is-${message.role}`} key={`${message.role}-${index}`}>
                {message.role === "assistant" && index === 0 && <Sparkles aria-hidden="true" />}
                <div className="ai-assistant__content">{message.role === "assistant" ? renderStructuredAiMessage(message, sendPrompt) : message.text}</div>
              </div>
            ))}
            {loading && <div className="ai-assistant__message is-assistant"><div className="ai-assistant__content">Thinking...</div></div>}
          </div>
          <form className="ai-assistant__composer" onSubmit={send}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your fleet..." />
            <button type="submit" disabled={loading || !input.trim()}><Send aria-hidden="true" /></button>
          </form>
        </section>
      )}
      {!activeTool && (
        <div className="assistant-launcher-stack">
          <button className="ai-assistant__launcher" type="button" onClick={() => setActiveTool("ai")}>
            <Bot aria-hidden="true" />
            <span className="assistant-launcher-label">AI</span>
          </button>
        </div>
      )}
    </div>
  );
}
