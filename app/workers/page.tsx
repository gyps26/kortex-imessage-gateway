"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../components/page-header';

type Channel = 'IMESSAGE' | 'WHATSAPP' | 'SMS';

export default function WorkersPage() {
  const [activeTab, setActiveTab] = useState<Channel>('IMESSAGE');
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [connectors, setConnectors] = useState<any[]>([]);
  const [workerToken, setWorkerToken] = useState('');
  const [installerUrl, setInstallerUrl] = useState('/api/installer');
  const [copied, setCopied] = useState(false);
  const [qrData, setQrData] = useState<{ workerId: string; qr: string } | null>(null);
  const [newDeviceApiKey, setNewDeviceApiKey] = useState<string | null>(null);

  const loadConnectors = useCallback(() => {
    fetch(`/api/workers/list?channel=${activeTab}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.profiles) setConnectors(data.profiles);
      });
  }, [activeTab]);

  useEffect(() => {
    loadConnectors();
    const interval = setInterval(loadConnectors, 10000);

    fetch('/api/settings/token')
      .then((res) => res.json())
      .then((data) => {
        if (data.token) setWorkerToken(data.token);
        if (data.installerUrl) setInstallerUrl(data.installerUrl);
      });

    return () => clearInterval(interval);
  }, [loadConnectors]);

  useEffect(() => {
    if (activeTab !== 'WHATSAPP' || !qrData) return;
    const interval = setInterval(() => {
      fetch(`/api/connectors/${qrData.workerId}/qr`)
        .then((res) => res.json())
        .then((data) => {
          if (data.qrCode && data.qrCode !== qrData.qr) {
            setQrData({ workerId: qrData.workerId, qr: data.qrCode });
          }
          if (data.status === 'active') {
            setQrData(null);
            loadConnectors();
          }
        });
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTab, qrData, loadConnectors]);

  const handleEditLimit = async (workerId: string, currentLimit: number) => {
    const newLimit = prompt('Enter new daily limit:', currentLimit.toString());
    if (newLimit && !isNaN(Number(newLimit))) {
      await fetch('/api/workers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, dailyLimit: Number(newLimit) }),
      });
      loadConnectors();
    }
  };

  const handleRemoveConnector = async (workerId: string) => {
    if (confirm('Are you sure you want to remove this connector?')) {
      await fetch(`/api/workers?workerId=${encodeURIComponent(workerId)}`, { method: 'DELETE' });
      loadConnectors();
    }
  };

  const handleCreateWhatsApp = async () => {
    const name = prompt('Connector name (optional):', 'WhatsApp Line 1');
    const res = await fetch('/api/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || undefined }),
    });
    const data = await res.json();
    if (data.profile) {
      loadConnectors();
      setQrData({ workerId: data.profile.workerId, qr: data.profile.qrCode || 'Waiting for QR...' });
    }
  };

  const handleRegisterAndroid = async () => {
    const res = await fetch('/api/gateway/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    const data = await res.json();
    if (data.apiKey) {
      setNewDeviceApiKey(data.apiKey);
      loadConnectors();
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(workerToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOnline = (lastPing: string) => Date.now() - new Date(lastPing).getTime() < 30_000;

  const tabClass = (tab: Channel) =>
    `px-6 py-2 rounded-t-xl font-medium text-sm ${
      activeTab === tab
        ? 'bg-indigo-600 text-white shadow'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
    }`;

  const titles: Record<Channel, string> = {
    IMESSAGE: 'iMessage Connectors',
    WHATSAPP: 'WhatsApp Connectors',
    SMS: 'Android SMS Devices',
  };

  return (
    <div className="flex-1 bg-[#F5F6FA] dark:bg-slate-950 overflow-y-auto">
      <PageHeader />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex mb-4 gap-2">
          <button type="button" onClick={() => setActiveTab('IMESSAGE')} className={tabClass('IMESSAGE')}>
            iMessage
          </button>
          <button type="button" onClick={() => setActiveTab('SMS')} className={tabClass('SMS')}>
            Android SMS
          </button>
          <button type="button" onClick={() => setActiveTab('WHATSAPP')} className={tabClass('WHATSAPP')}>
            WhatsApp
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-b-xl rounded-tr-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{titles[activeTab]}</h2>
            <div className="flex gap-4">
              {activeTab === 'IMESSAGE' && (
                <button
                  onClick={() => setSetupModalOpen(true)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg text-sm shadow-sm transition-colors"
                >
                  Add Device
                </button>
              )}
              {activeTab === 'WHATSAPP' && (
                <button
                  onClick={handleCreateWhatsApp}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 rounded-lg text-sm shadow-sm transition-colors"
                >
                  Add WhatsApp Line
                </button>
              )}
              {activeTab === 'SMS' && (
                <button
                  onClick={handleRegisterAndroid}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg text-sm shadow-sm transition-colors"
                >
                  Register Device
                </button>
              )}
            </div>
          </div>

          {qrData && activeTab === 'WHATSAPP' && (
            <div className="mb-6 p-4 border border-green-200 rounded-xl bg-green-50 dark:bg-green-950/30">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Scan QR with WhatsApp</p>
              <p className="font-mono text-xs break-all text-slate-600 dark:text-slate-400">{qrData.qr}</p>
            </div>
          )}

          {newDeviceApiKey && activeTab === 'SMS' && (
            <div className="mb-6 p-4 border border-emerald-200 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">Device API Key (save now — shown once)</p>
              <code className="text-xs break-all">{newDeviceApiKey}</code>
              <button
                type="button"
                onClick={() => setNewDeviceApiKey(null)}
                className="block mt-2 text-xs text-emerald-600 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead>
              <tr className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 tracking-wider">
                <th className="pb-4">Name</th>
                <th className="pb-4">Assigned Location</th>
                <th className="pb-4 text-center">Daily Limit</th>
                <th className="pb-4 text-center">Daily Sent</th>
                <th className="pb-4 text-center">Status</th>
                <th className="pb-4 text-center">Last Ping</th>
                <th className="pb-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {connectors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center">
                    No connectors found for {activeTab}.
                  </td>
                </tr>
              ) : (
                connectors.map((worker) => {
                  const online = isOnline(worker.lastPing);
                  return (
                    <tr key={worker.workerId}>
                      <td className="py-4 text-indigo-500 font-medium">
                        {worker.name || worker.workerId}
                        {worker.whatsappPhone && (
                          <span className="block text-xs text-slate-400 font-mono">{worker.whatsappPhone}</span>
                        )}
                        {worker.deviceModel && (
                          <span className="block text-xs text-slate-400">{worker.deviceBrand} {worker.deviceModel}</span>
                        )}
                      </td>
                      <td className="py-4 font-mono text-xs">{worker.assignedLocationId || 'Unassigned'}</td>
                      <td className="py-4 text-center">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-mono">{worker.dailyLimit || 50}</span>
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-indigo-400 text-xs font-mono">{worker.dailyCount || 0}</span>
                      </td>
                      <td className="py-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            online && worker.status === 'active'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {online && worker.status === 'active' ? 'online' : worker.status}
                        </span>
                      </td>
                      <td className="py-4 text-center text-xs font-mono">{new Date(worker.lastPing).toLocaleString()}</td>
                      <td className="py-4 flex gap-2 justify-end">
                        {activeTab === 'WHATSAPP' && worker.status !== 'active' && (
                          <button
                            onClick={() => setQrData({ workerId: worker.workerId, qr: worker.qrCode || 'Waiting for QR...' })}
                            className="border border-green-200 text-green-600 hover:bg-green-50 px-3 py-1 rounded text-xs font-semibold"
                          >
                            Show QR
                          </button>
                        )}
                        <button
                          onClick={() => handleEditLimit(worker.workerId, worker.dailyLimit || 50)}
                          className="border border-indigo-200 text-indigo-500 hover:bg-indigo-50 px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Edit Limit
                        </button>
                        <button
                          onClick={() => handleRemoveConnector(worker.workerId)}
                          className="border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {setupModalOpen && activeTab === 'IMESSAGE' && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[450px] rounded-2xl shadow-xl flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">iMessage Gateway Setup</h3>
              <button onClick={() => setSetupModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                X
              </button>
            </div>
            <div className="p-8 pb-10 space-y-4 text-sm text-slate-500">
              <p className="flex items-start gap-4">
                <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">1</span>
                <span>
                  Download the{' '}
                  <a href={installerUrl} className="text-indigo-500 underline" download>
                    CLI installer script
                  </a>{' '}
                  or use the Electron Mac app
                </span>
              </p>
              <p className="flex items-start gap-4">
                <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">2</span>
                <span>Launch the app and paste the connection token below</span>
              </p>
              <p className="flex items-start gap-4">
                <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">3</span>
                <span>
                  Assign the connector to a GHL location on{' '}
                  <Link href="/subaccounts" className="text-indigo-500 underline">
                    Subaccounts
                  </Link>
                </span>
              </p>

              <div className="mt-8 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center relative">
                <p className="text-xs font-bold text-slate-500 mb-2">Connection Token (URL|SECRET)</p>
                <div className="flex border-2 border-indigo-200 dark:border-indigo-900 rounded-lg overflow-hidden bg-white dark:bg-slate-900 mb-2">
                  <div className="px-4 py-3 font-mono text-indigo-500 text-xs truncate flex-1 select-all">{workerToken || 'Loading...'}</div>
                  <button
                    onClick={copyToken}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 transition-colors shrink-0"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">Do not share this token.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
