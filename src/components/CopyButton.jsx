import { useState } from 'react';

export default function CopyButton({ value, label }) {
  const [status, setStatus] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Copié');
    } catch {
      setStatus('Copie impossible');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleCopy}
        className="mt-2 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
      >
        Copier {label}
      </button>
      {status && (
        <span className="mt-2 text-sm text-slate-400" role="status" aria-live="polite">
          {status}
        </span>
      )}
    </div>
  );
}
