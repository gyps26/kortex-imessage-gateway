"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../components/page-header';

export default function MonitorPage() {
  const [stats, setStats] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const load = () => {
      fetch('/api/dashboard/stats')
        .then((res) => res.json())
        .then(setStats);
      fetch('/api/messages')
        .then((res) => res.json())
        .then((data) => {
          if (data.messages) {
            setMessages(data.messages.filter((m: any) => ['pending', 'queued', 'failed'].includes(m.status)).slice(0, 20));
          }
        });
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 bg-[#F5F6FA] dark:bg-slate-950 overflow-y-auto">
      <PageHeader />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Queue Monitor</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Live message queue and connector status by channel</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pending', value: stats?.pendingMessages, color: 'amber' },
            { label: 'Active Connectors', value: stats?.activeWorkers, color: 'emerald' },
            { label: 'Sent Today', value: stats?.messagesSentToday, color: 'indigo' },
            { label: 'Failed Today', value: stats?.failedMessages, color: 'red' },
          ].map((item) => (
            <div key={item.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{item.value ?? '—'}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(['IMESSAGE', 'WHATSAPP', 'SMS'] as const).map((channel) => (
            <div key={channel} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{channel}</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                {stats?.connectorsByChannel?.[channel] ?? 0} active
              </p>
              <p className="text-xs text-slate-400 mt-1">{stats?.channelQueue?.[channel] ?? 0} queued</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Queue Items</h3>
            <div className="flex gap-2">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  stats?.redisConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                }`}
              >
                BullMQ: {stats?.redisConnected ? 'Connected' : 'Fallback'}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  stats?.whatsappQueueConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                }`}
              >
                WhatsApp: {stats?.whatsappQueueConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>

          {messages.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No pending, queued, or failed messages.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-3">Phone</th>
                  <th className="pb-3">Channel</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Location</th>
                  <th className="pb-3">Connector</th>
                  <th className="pb-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {messages.map((m) => (
                  <tr key={m._id}>
                    <td className="py-3 font-mono text-xs">{m.phone}</td>
                    <td className="py-3 text-xs font-semibold">{m.channel || 'IMESSAGE'}</td>
                    <td className="py-3">
                      <span className="text-xs font-semibold uppercase">{m.status}</span>
                    </td>
                    <td className="py-3 font-mono text-xs">{m.locationId || '—'}</td>
                    <td className="py-3 font-mono text-xs">{m.workerId || m.deviceId || '—'}</td>
                    <td className="py-3 text-xs text-slate-500">{new Date(m.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-slate-400 text-center">
          <Link href="/settings" className="text-indigo-500 underline">
            Settings
          </Link>{' '}
          — configure Redis, Firebase, and webhook URLs
        </p>
      </div>
    </div>
  );
}
