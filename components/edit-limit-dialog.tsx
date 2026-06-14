"use client";

import React, { useEffect, useState } from 'react';

interface EditLimitDialogProps {
  open: boolean;
  connectorName: string;
  currentLimit: number;
  loading?: boolean;
  onSave: (limit: number) => void;
  onCancel: () => void;
}

export function EditLimitDialog({
  open,
  connectorName,
  currentLimit,
  loading = false,
  onSave,
  onCancel,
}: EditLimitDialogProps) {
  const [value, setValue] = useState(currentLimit.toString());

  useEffect(() => {
    if (open) setValue(currentLimit.toString());
  }, [open, currentLimit]);

  if (!open) return null;

  const parsed = Number(value);
  const valid = value.trim() !== '' && !isNaN(parsed) && parsed >= 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Edit Daily Limit</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{connectorName}</p>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Daily message limit
        </label>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-mono"
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
            onClick={() => valid && onSave(parsed)}
            disabled={loading || !valid}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
