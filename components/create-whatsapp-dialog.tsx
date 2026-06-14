"use client";

import React, { useState } from 'react';

interface CreateWhatsAppDialogProps {
  open: boolean;
  loading?: boolean;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

export function CreateWhatsAppDialog({
  open,
  loading = false,
  onCreate,
  onCancel,
}: CreateWhatsAppDialogProps) {
  const [name, setName] = useState('WhatsApp Line 1');

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Add WhatsApp Line</h3>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Connector name (optional)
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="WhatsApp Line 1"
          className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCreate(name.trim() || 'WhatsApp Line 1')}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
