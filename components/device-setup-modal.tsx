"use client";

import React from 'react';

interface DeviceSetupModalProps {
  open: boolean;
  apiKey: string;
  onClose: () => void;
}

export function DeviceSetupModal({ open, apiKey, onClose }: DeviceSetupModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Device Setup</h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">Save this key now — shown once</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(apiKey)}`}
            alt="API Key QR Code"
            className="w-[250px] h-[250px] rounded-lg bg-white p-2 shadow-sm"
          />
          <p className="text-xs text-slate-500 text-center">Scan from the Android app, or paste the key below</p>
          <code className="text-xs break-all block w-full bg-slate-50 dark:bg-slate-800 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg font-mono">
            {apiKey}
          </code>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
