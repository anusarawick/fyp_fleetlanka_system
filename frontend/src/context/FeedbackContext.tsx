import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type FeedbackTone = "success" | "error" | "warning" | "info";

type FeedbackItem = {
  id: string;
  tone: FeedbackTone;
  title: string;
  message?: string;
};

type FeedbackInput = {
  title: string;
  message?: string;
};

type FeedbackContextType = {
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const FeedbackContext = createContext<FeedbackContextType | null>(null);

const TOAST_DURATION: Record<FeedbackTone, number> = {
  success: 3200,
  info: 3600,
  warning: 6500,
  error: 8000,
};

function normalizeInput(title: string, message?: string): FeedbackInput {
  return {
    title: title.trim() || "Notice",
    message: message?.trim() || undefined,
  };
}

function toneIcon(tone: FeedbackTone) {
  if (tone === "success") return <CheckCircle2 aria-hidden="true" />;
  if (tone === "error") return <XCircle aria-hidden="true" />;
  if (tone === "warning") return <AlertTriangle aria-hidden="true" />;
  return <Info aria-hidden="true" />;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    window.clearTimeout(timers.current[id]);
    delete timers.current[id];
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    Object.values(timers.current).forEach((timer) => window.clearTimeout(timer));
    timers.current = {};
    setItems([]);
  }, []);

  const push = useCallback((tone: FeedbackTone, title: string, message?: string) => {
    const input = normalizeInput(title, message);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: FeedbackItem = { id, tone, title: input.title, message: input.message };
    setItems((current) => [item, ...current].slice(0, 5));
    timers.current[id] = window.setTimeout(() => dismiss(id), TOAST_DURATION[tone]);
    return id;
  }, [dismiss]);

  const value = useMemo<FeedbackContextType>(() => ({
    success: (title, message) => push("success", title, message),
    error: (title, message) => push("error", title, message),
    warning: (title, message) => push("warning", title, message),
    info: (title, message) => push("info", title, message),
    dismiss,
    clear,
  }), [clear, dismiss, push]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="feedback-host" role="status" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div className={`feedback-toast feedback-toast--${item.tone}`} key={item.id}>
            <span className="feedback-toast__icon">{toneIcon(item.tone)}</span>
            <span className="feedback-toast__body">
              <strong>{item.title}</strong>
              {item.message && <small>{item.message}</small>}
            </span>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification">
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}
