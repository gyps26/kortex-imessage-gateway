"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../components/page-header';
import { useToast } from '../../components/toast';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { EditLimitDialog } from '../../components/edit-limit-dialog';
import { QrModal, QR_PLACEHOLDER } from '../../components/qr-modal';
import { CreateWhatsAppDialog } from '../../components/create-whatsapp-dialog';
import { DeviceSetupModal } from '../../components/device-setup-modal';

type Channel = 'IMESSAGE' | 'WHATSAPP' | 'SMS';

interface Connector {
  workerId: string;
  name?: string;
  status?: string;
  dailyLimit?: number;
  dailyCount?: number;
  lastPing?: string;
  assignedLocationId?: string;
  whatsappPhone?: string;
  deviceBrand?: string;
  deviceModel?: string;
  qrCode?: string;
  fcmToken?: string;
}

export default function WorkersPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Channel>('IMESSAGE');
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [workerToken, setWorkerToken] = useState('');
  const [installerUrl, setInstallerUrl] = useState('/api/installer');
  const [copied, setCopied] = useState(false);

  const [qrModal, setQrModal] = useState<{ workerId: string; qr: string; error?: string | null } | null>(null);
  const [deviceSetupKey, setDeviceSetupKey] = useState<string | null>(null);

  const [editLimit, setEditLimit] = useState<{ workerId: string; name: string; limit: number } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ workerId: string; name: string } | null>(null);
  const [createWhatsAppOpen, setCreateWhatsAppOpen] = useState(false);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [whatsappWorkerOnline, setWhatsappWorkerOnline] = useState<boolean | null>(null);
  const [smsHealth, setSmsHealth] = useState<{ firebaseConfigured: boolean } | null>(null);

  const loadConnectors = useCallback(async () => {
    try {
      const res = await fetch(`/api/workers/list?channel=${activeTab}&t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load connectors');
      const data = await res.json();
      if (data.profiles) setConnectors(data.profiles);
    } catch {
      showToast('Failed to load connectors', 'error');
    }
  }, [activeTab, showToast]);

  const loadWhatsappHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/connectors/health');
      if (res.ok) {
        const data = await res.json();
        setWhatsappWorkerOnline(data.workerOnline ?? false);
      }
    } catch {
      setWhatsappWorkerOnline(false);
    }
  }, []);

  const loadSmsHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/gateway/health');
      if (res.ok) {
        const data = await res.json();
        setSmsHealth({ firebaseConfigured: data.firebaseConfigured ?? false });
      }
    } catch {
      setSmsHealth({ firebaseConfigured: false });
    }
  }, []);

  useEffect(() => {
    loadConnectors();
    const interval = setInterval(loadConnectors, 10000);

    fetch('/api/settings/token')
      .then((res) => res.json())
      .then((data) => {
        if (data.token) setWorkerToken(data.token);
        if (data.installerUrl) setInstallerUrl(data.installerUrl);
      })
      .catch(() => {});

    return () => clearInterval(interval);
  }, [loadConnectors]);

  useEffect(() => {
    if (activeTab === 'WHATSAPP') {
      loadWhatsappHealth();
      const interval = setInterval(loadWhatsappHealth, 15000);
      return () => clearInterval(interval);
    }
    if (activeTab === 'SMS') {
      loadSmsHealth();
    }
  }, [activeTab, loadWhatsappHealth, loadSmsHealth]);

  useEffect(() => {
    if (activeTab !== 'WHATSAPP' || !qrModal) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/connectors/${qrModal.workerId}/qr`);
        if (!res.ok) {
          setQrModal((prev) => prev ? { ...prev, error: 'Could not fetch QR status' } : null);
          return;
        }
        const data = await res.json();
        if (data.qrCode && data.qrCode !== qrModal.qr) {
          setQrModal({ workerId: qrModal.workerId, qr: data.qrCode, error: null });
        }
        if (data.status === 'active') {
          setQrModal(null);
          showToast('WhatsApp connected successfully', 'success');
          loadConnectors();
        }
      } catch {
        setQrModal((prev) => prev ? { ...prev, error: 'Network error while polling QR' } : null);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [activeTab, qrModal, loadConnectors, showToast]);

  const handleSaveLimit = async (limit: number) => {
    if (!editLimit) return;
    setLoadingAction(`edit-${editLimit.workerId}`);
    try {
      const res = await fetch('/api/workers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId: editLimit.workerId, dailyLimit: limit }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update limit');
      }
      showToast('Daily limit updated', 'success');
      setEditLimit(null);
      loadConnectors();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update limit', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setLoadingAction(`remove-${removeTarget.workerId}`);
    try {
      const res = await fetch(`/api/workers?workerId=${encodeURIComponent(removeTarget.workerId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove connector');
      }
      showToast('Connector removed', 'success');
      setRemoveTarget(null);
      loadConnectors();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove connector', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreateWhatsApp = async (name: string) => {
    setLoadingAction('create-whatsapp');
    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create connector');
      setCreateWhatsAppOpen(false);
      showToast('WhatsApp line created — scan the QR to connect', 'success');
      loadConnectors();
      setQrModal({
        workerId: data.profile.workerId,
        qr: data.profile.qrCode || QR_PLACEHOLDER,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create connector', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRegisterAndroid = async () => {
    setLoadingAction('register-android');
    try {
      const res = await fetch('/api/gateway/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register device');
      if (data.apiKey) {
        setDeviceSetupKey(data.apiKey);
        showToast('Device registered — scan the QR from your Android app', 'success');
        loadConnectors();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not register device', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRotateSmsKey = async (workerId: string) => {
    setLoadingAction(`rotate-${workerId}`);
    try {
      const res = await fetch(`/api/gateway/devices/${workerId}/rotate-key`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate new key');
      setDeviceSetupKey(data.apiKey);
      showToast('New setup QR generated', 'success');
      loadConnectors();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate setup QR', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRePairWhatsApp = async (workerId: string) => {
    setLoadingAction(`repair-${workerId}`);
    try {
      const res = await fetch(`/api/connectors/${workerId}/repair`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start re-pair');
      showToast('Re-pair started — scan the new QR', 'success');
      loadConnectors();
      setQrModal({ workerId, qr: QR_PLACEHOLDER });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to re-pair', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(workerToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOnline = (lastPing?: string) => lastPing ? Date.now() - new Date(lastPing).getTime() < 30_000 : false;

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

  const unassignedCount = connectors.filter((c) => !c.assignedLocationId).length;

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
                  type="button"
                  onClick={() => setSetupModalOpen(true)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg text-sm shadow-sm transition-colors"
                >
                  Add Device
                </button>
              )}
              {activeTab === 'WHATSAPP' && (
                <button
                  type="button"
                  onClick={() => setCreateWhatsAppOpen(true)}
                  disabled={loadingAction === 'create-whatsapp'}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  {loadingAction === 'create-whatsapp' ? 'Creating...' : 'Add WhatsApp Line'}
                </button>
              )}
              {activeTab === 'SMS' && (
                <button
                  type="button"
                  onClick={handleRegisterAndroid}
                  disabled={loadingAction === 'register-android'}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  {loadingAction === 'register-android' ? 'Registering...' : 'Register Device'}
                </button>
              )}
            </div>
          </div>

          {activeTab === 'WHATSAPP' && whatsappWorkerOnline === false && (
            <div className="mb-6 p-4 border border-amber-200 rounded-xl bg-amber-50 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                WhatsApp worker is offline — QR codes cannot be generated.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Start the worker with <code className="font-mono">docker compose up</code> or{' '}
                <code className="font-mono">npm run worker:whatsapp</code>
              </p>
            </div>
          )}

          {activeTab === 'SMS' && smsHealth && !smsHealth.firebaseConfigured && (
            <div className="mb-6 p-4 border border-amber-200 rounded-xl bg-amber-50 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Outbound SMS disabled — Firebase is not configured on the server.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file.
              </p>
            </div>
          )}

          {unassignedCount > 0 && (
            <div className="mb-6 p-4 border border-indigo-200 rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
              <p className="text-sm text-indigo-800 dark:text-indigo-300">
                {unassignedCount} connector{unassignedCount > 1 ? 's' : ''} not assigned to a GHL location.{' '}
                <Link href="/subaccounts" className="underline font-semibold">Assign on Subaccounts</Link>
              </p>
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
                  const actionLoading = (suffix: string) => loadingAction === `${suffix}-${worker.workerId}`;
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
                        {activeTab === 'SMS' && worker.status === 'pending' && !worker.fcmToken && (
                          <span className="block text-xs text-amber-500 mt-1">App not connected yet</span>
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
                              : worker.status === 'pending'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {online && worker.status === 'active' ? 'online' : worker.status}
                        </span>
                      </td>
                      <td suppressHydrationWarning className="py-4 text-center text-xs font-mono">
                        {worker.lastPing ? new Date(worker.lastPing).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex gap-2 justify-end flex-wrap">
                          {activeTab === 'WHATSAPP' && worker.status !== 'active' && (
                            <button
                              type="button"
                              onClick={() => setQrModal({ workerId: worker.workerId, qr: worker.qrCode || QR_PLACEHOLDER })}
                              className="border border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 px-3 py-1 rounded text-xs font-semibold"
                            >
                              Show QR
                            </button>
                          )}
                          {activeTab === 'WHATSAPP' && worker.status === 'inactive' && worker.whatsappPhone && (
                            <button
                              type="button"
                              onClick={() => handleRePairWhatsApp(worker.workerId)}
                              disabled={actionLoading('repair')}
                              className="border border-amber-200 text-amber-600 hover:bg-amber-50 px-3 py-1 rounded text-xs font-semibold disabled:opacity-50"
                            >
                              {actionLoading('repair') ? '...' : 'Re-pair'}
                            </button>
                          )}
                          {activeTab === 'SMS' && (worker.status === 'pending' || !worker.fcmToken) && (
                            <button
                              type="button"
                              onClick={() => handleRotateSmsKey(worker.workerId)}
                              disabled={actionLoading('rotate')}
                              className="border border-emerald-200 text-emerald-600 hover:bg-emerald-50 px-3 py-1 rounded text-xs font-semibold disabled:opacity-50"
                            >
                              {actionLoading('rotate') ? '...' : 'Show Setup QR'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditLimit({ workerId: worker.workerId, name: worker.name || worker.workerId, limit: worker.dailyLimit || 50 })}
                            disabled={actionLoading('edit')}
                            className="border border-indigo-200 text-indigo-500 hover:bg-indigo-50 px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            Edit Limit
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoveTarget({ workerId: worker.workerId, name: worker.name || worker.workerId })}
                            disabled={actionLoading('remove')}
                            className="border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <QrModal
        open={!!qrModal && activeTab === 'WHATSAPP'}
        title="Scan QR with WhatsApp"
        subtitle={qrModal?.workerId}
        qrData={qrModal?.qr || QR_PLACEHOLDER}
        error={qrModal?.error}
        workerOffline={whatsappWorkerOnline === false}
        onClose={() => setQrModal(null)}
      />

      <DeviceSetupModal
        open={!!deviceSetupKey && activeTab === 'SMS'}
        apiKey={deviceSetupKey || ''}
        onClose={() => setDeviceSetupKey(null)}
      />

      <CreateWhatsAppDialog
        open={createWhatsAppOpen}
        loading={loadingAction === 'create-whatsapp'}
        onCreate={handleCreateWhatsApp}
        onCancel={() => setCreateWhatsAppOpen(false)}
      />

      <EditLimitDialog
        open={!!editLimit}
        connectorName={editLimit?.name || ''}
        currentLimit={editLimit?.limit || 50}
        loading={!!editLimit && loadingAction === `edit-${editLimit.workerId}`}
        onSave={handleSaveLimit}
        onCancel={() => setEditLimit(null)}
      />

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove Connector"
        message={`Are you sure you want to remove "${removeTarget?.name}"? This cannot be undone.`}
        confirmLabel="Remove"
        destructive
        loading={!!removeTarget && loadingAction === `remove-${removeTarget.workerId}`}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      {setupModalOpen && activeTab === 'IMESSAGE' && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[450px] rounded-2xl shadow-xl flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">iMessage Gateway Setup</h3>
              <button type="button" onClick={() => setSetupModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
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
                    type="button"
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
