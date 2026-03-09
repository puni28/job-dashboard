'use client';

import { CheckCircle, XCircle, Info } from 'lucide-react';

type Props = {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
};

const STYLES = {
  success: 'bg-green-500/20 border-green-500/50 text-green-300',
  error: 'bg-red-500/20 border-red-500/50 text-red-300',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
};

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

export default function SyncToast({ message, type, onClose }: Props) {
  const Icon = ICONS[type];
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl ${STYLES[type]} max-w-sm`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  );
}
