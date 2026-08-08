import { useEffect, useRef } from "react";
import { useNotification, type NotificationPayload } from "../contexts/NotificationContext";

const iconMap: Record<NotificationPayload["type"], string> = {
  error: "✕",
  info: "i",
  warning: "!",
};

const headerClassMap: Record<NotificationPayload["type"], string> = {
  error: "bg-error text-error-content",
  info: "bg-info text-info-content",
  warning: "bg-warning text-warning-content",
};

export default function NotificationModal() {
  const { notification, isOpen, closeNotification } = useNotification();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && notification) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, notification]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      closeNotification();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [closeNotification]);

  if (!notification) return null;

  const headerClass = headerClassMap[notification.type];

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box w-11/12 max-w-sm p-0 overflow-hidden">
        <div className={`flex items-center gap-2 px-5 py-3 ${headerClass}`}>
          <span className="text-lg font-bold opacity-80">{iconMap[notification.type]}</span>
          <h3 className="font-semibold text-sm flex-1">{notification.title}</h3>
        </div>
        <div className="px-5 py-3">
          <p className="text-sm text-base-content/70 whitespace-pre-wrap break-words">
            {notification.message}
          </p>
        </div>
        <div className="modal-action px-5 pb-3 mt-0">
          <form method="dialog">
            <button className="btn btn-sm">Cerrar</button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
