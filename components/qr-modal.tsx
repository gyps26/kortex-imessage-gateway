"use client";

import React from 'react';

const QR_PLACEHOLDER = 'Waiting for QR...';

interface QrModalProps {
  open: boolean;
  title: string;
  qrData: string;
  subtitle?: string;
  error?: string | null;
  workerOffline?: boolean;
  onClose: () => void;
}

function qrImageUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}`;
}

export function QrModal({
  open,
  title,
  qrData,
  subtitle,
  error,
  workerOffline,
  onClose,
}: QrModalProps) {
  if (!open) return null;

  const hasQr = qrData && qrData !== QR_PLACEHOLDER;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>

        {workerOffline && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
            WhatsApp worker is offline. Start it with <code className="font-mono text-xs">docker compose up</code> or{' '}
            <code className="font-mono text-xs">npm run worker:whatsapp</code>.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          {hasQr ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl(qrData)}
                alt="QR Code"
                className="w-[250px] h-[250px] rounded-lg bg-white p-2 shadow-sm"
              />
              <p className="text-xs text-slate-500 text-center">Scan with WhatsApp on your phone</p>
            </>
          ) : (
            <div className="w-[250px] h-[250px] rounded-lg bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Waiting for QR code...</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export { QR_PLACEHOLDER };
