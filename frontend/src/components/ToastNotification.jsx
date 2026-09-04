import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let _uid = 0;
const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'success', title = '') => {
    const id = ++_uid;
    setToasts((prev) => [...prev, { id, message, type, title }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="bb-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`bb-toast ${t.type}`}>
            <span className="toast-icon">{icons[t.type]}</span>
            <div className="toast-body">
              {t.title && <div className="toast-title">{t.title}</div>}
              <div className="toast-msg">{t.message}</div>
            </div>
            <button className="toast-close" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
