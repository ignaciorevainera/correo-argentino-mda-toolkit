import { createContext, useContext, useState, useCallback } from "react";

export type NotificationType = "error" | "info" | "warning";

export interface NotificationPayload {
  title: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextValue {
  showNotification: (payload: NotificationPayload) => void;
  closeNotification: () => void;
  notification: NotificationPayload | null;
  isOpen: boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<NotificationPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const showNotification = useCallback((payload: NotificationPayload) => {
    setNotification(payload);
    setIsOpen(true);
  }, []);

  const closeNotification = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, closeNotification, notification, isOpen }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
}
