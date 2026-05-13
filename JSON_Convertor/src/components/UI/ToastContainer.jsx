import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import useUIStore from '../../store/useUIStore';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const colors = {
  success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', text: '#34d399' },
  error: { bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.2)', text: '#fb7185' },
  info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', text: '#60a5fa' },
};

const ToastContainer = () => {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || Info;
        const c = colors[toast.type] || colors.info;
        return (
          <div key={toast.id} className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl animate-slide-left" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
            <Icon size={16} style={{ color: c.text }} />
            <span className="text-sm" style={{ color: c.text }}>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
