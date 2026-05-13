import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ExternalLink, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NotificationItem, useNotifications } from "../context/NotificationContext";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toneClass(item: NotificationItem) {
  if (item.severity === "danger") return "notification-item--danger";
  if (item.severity === "warning") return "notification-item--warning";
  if (item.severity === "success") return "notification-item--success";
  return "notification-item--info";
}

export default function NotificationBell({ compact = false }: { compact?: boolean }) {
  const {
    notifications,
    unreadCount,
    loading,
    hasLoaded,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function openPanel() {
    setOpen((value) => !value);
    if (!open) {
      await refreshNotifications();
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.read_at) {
      await markNotificationRead(item.id);
    }
    if (item.action_url) {
      setOpen(false);
      navigate(item.action_url);
    }
  }

  return (
    <div className={`notification-bell ${compact ? "notification-bell--compact" : ""}`} ref={menuRef}>
      <button
        className={compact ? "pwa-header-icon-btn notification-bell__button" : "topbar__icon-btn notification-bell__button"}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        type="button"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        aria-expanded={open}
        onClick={openPanel}
      >
        <Bell aria-hidden="true" className={compact ? undefined : "topbar__icon-svg"} />
        {unreadCount > 0 && <span className={compact ? "notification-bell__badge" : "topbar__badge"}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-menu">
          <div className="notification-menu__header">
            <div>
              <strong>Notifications</strong>
              <span>{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</span>
            </div>
            <button type="button" onClick={markAllNotificationsRead} disabled={!unreadCount}>
              <CheckCheck aria-hidden="true" />
              Mark read
            </button>
          </div>

          {loading && !hasLoaded && notifications.length === 0 ? (
            <div className="notification-menu__empty"><Loader2 aria-hidden="true" /> Loading notifications</div>
          ) : notifications.length === 0 ? (
            <div className="notification-menu__empty">No notifications right now.</div>
          ) : (
            <div className="notification-menu__list">
              {notifications.slice(0, 12).map((item) => (
                <article className={`notification-item ${toneClass(item)} ${item.read_at ? "" : "notification-item--unread"}`} key={item.id}>
                  <button className="notification-item__body" type="button" onClick={() => openNotification(item)}>
                    <span className="notification-item__dot" />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.message}</small>
                      <em>{formatTime(item.created_at)}</em>
                    </span>
                    {item.action_url && <ExternalLink aria-hidden="true" />}
                  </button>
                  <button
                    className="notification-item__dismiss"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      dismissNotification(item.id);
                    }}
                    aria-label="Dismiss notification"
                  >
                    <X aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
