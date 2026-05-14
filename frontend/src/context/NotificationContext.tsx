import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, isAuthSessionExpiredError } from "../services/api";
import { useAuth } from "./AuthContext";
import { useFeedback } from "./FeedbackContext";

export type NotificationItem = {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: "success" | "info" | "warning" | "danger" | string;
  category: string;
  action_url?: string;
  due_date?: string;
  read_at?: string | null;
  created_at: string;
};

type NotificationContextType = {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  hasLoaded: boolean;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, authReady } = useAuth();
  const feedback = useFeedback();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const refreshNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setHasLoaded(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await apiGet<NotificationItem[]>("/notifications", token);
      setNotifications(rows);
      setHasLoaded(true);
    } catch (err: any) {
      if (isAuthSessionExpiredError(err)) return;
      feedback.error("Notifications unavailable", err.message || "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, [feedback, token]);

  useEffect(() => {
    if (!authReady || !token) {
      setNotifications([]);
      setHasLoaded(false);
      return;
    }
    refreshNotifications();
  }, [authReady, refreshNotifications, token]);

  useEffect(() => {
    if (!token) return;
    const onFocus = () => refreshNotifications();
    const interval = window.setInterval(refreshNotifications, 60_000);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshNotifications, token]);

  async function markNotificationRead(id: string) {
    if (!token) return;
    const previous = notifications;
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item));
    try {
      const updated = await apiPost<NotificationItem>(`/notifications/${id}/read`, {}, token);
      setNotifications((current) => current.map((item) => item.id === id ? updated : item));
    } catch (err: any) {
      if (isAuthSessionExpiredError(err)) return;
      setNotifications(previous);
      feedback.error("Notification update failed", err.message || "Could not mark notification as read");
    }
  }

  async function markAllNotificationsRead() {
    if (!token) return;
    const timestamp = new Date().toISOString();
    const previous = notifications;
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || timestamp })));
    try {
      await apiPost("/notifications/read-all", {}, token);
    } catch (err: any) {
      if (isAuthSessionExpiredError(err)) return;
      setNotifications(previous);
      feedback.error("Notification update failed", err.message || "Could not mark notifications as read");
    }
  }

  async function dismissNotification(id: string) {
    if (!token) return;
    const previous = notifications;
    setNotifications((current) => current.filter((item) => item.id !== id));
    try {
      await apiPost<NotificationItem>(`/notifications/${id}/dismiss`, {}, token);
    } catch (err: any) {
      if (isAuthSessionExpiredError(err)) return;
      setNotifications(previous);
      feedback.error("Notification dismiss failed", err.message || "Could not dismiss notification");
    }
  }

  const value = useMemo<NotificationContextType>(() => ({
    notifications,
    unreadCount,
    loading,
    hasLoaded,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
  }), [hasLoaded, loading, notifications, refreshNotifications, unreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
