'use client';

import { useState, useCallback } from 'react';

// ============================================================
// Admin Dashboard — Logs Viewer
// Protected by ADMIN_SECRET, reads from Firestore system_logs
// ============================================================

interface LogEntry {
    _id: string;
    correlation_id: string;
    level: string;
    source: string;
    step: string;
    message: string;
    data?: Record<string, unknown>;
    timestamp: string;
}

const LEVEL_COLORS: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800',
    warn: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    critical: 'bg-red-200 text-red-900 font-bold',
};

const SOURCE_COLORS: Record<string, string> = {
    chat: 'bg-teal-100 text-teal-800',
    webhook: 'bg-purple-100 text-purple-800',
    scanner: 'bg-indigo-100 text-indigo-800',
    auth: 'bg-orange-100 text-orange-800',
    admin: 'bg-gray-100 text-gray-800',
    stripe: 'bg-violet-100 text-violet-800',
};

export default function AdminLogsPage() {
    const [secret, setSecret] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filters
    const [levelFilter, setLevelFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [cidFilter, setCidFilter] = useState('');
    const [limitFilter, setLimitFilter] = useState('100');
    const [collectionFilter, setCollectionFilter] = useState('system_logs');

    // Expanded log
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchLogs = useCallback(async (overrideSecret?: string) => {
        const token = overrideSecret || secret;
        if (!token) return;

        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams();
            params.set('secret', token);
            if (levelFilter) params.set('level', levelFilter);
            if (sourceFilter) params.set('source', sourceFilter);
            if (cidFilter) params.set('cid', cidFilter);
            if (limitFilter) params.set('limit', limitFilter);
            if (collectionFilter) params.set('collection', collectionFilter);

            const res = await fetch(`/api/admin/logs?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 401) {
                    setAuthenticated(false);
                    setError('Secret invalide.');
                    return;
                }
                setError(data.error || 'Erreur inconnue');
                if (data.logs) setLogs(data.logs);
                return;
            }

            setAuthenticated(true);
            setLogs(data.logs || []);
        } catch {
            setError('Erreur de connexion.');
        } finally {
            setLoading(false);
        }
    }, [secret, levelFilter, sourceFilter, cidFilter, limitFilter, collectionFilter]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        fetchLogs();
    };

    const filterByCid = (cid: string) => {
        setCidFilter(cid);
        setLevelFilter('');
        setSourceFilter('');
        // Fetch with new filter
        setTimeout(() => fetchLogs(), 50);
    };

    // ---- LOGIN SCREEN ----
    if (!authenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F9F8' }}>
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
                    <h1 className="text-xl font-bold mb-4" style={{ color: '#212E53' }}>
                        AYO Admin Logs
                    </h1>
                    <input
                        type="password"
                        value={secret}
                        onChange={e => setSecret(e.target.value)}
                        placeholder="Admin Secret"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                        autoFocus
                    />
                    {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                        style={{ background: '#4A919E' }}
                    >
                        {loading ? 'Connexion...' : 'Accéder'}
                    </button>
                </form>
            </div>
        );
    }

    // ---- DASHBOARD ----
    return (
        <div className="min-h-screen" style={{ background: '#F5F9F8' }}>
            {/* Header */}
            <header className="px-6 py-4 shadow-sm" style={{ background: '#212E53' }}>
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <h1 className="text-white font-bold text-lg">AYO Admin — Logs</h1>
                    <span className="text-gray-300 text-xs">{logs.length} entrées</span>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters Bar */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Collection</label>
                        <select
                            value={collectionFilter}
                            onChange={e => setCollectionFilter(e.target.value)}
                            className="border rounded-lg px-3 py-1.5 text-sm"
                        >
                            <option value="system_logs">system_logs</option>
                            <option value="webhook_debug">webhook_debug (legacy)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Niveau</label>
                        <select
                            value={levelFilter}
                            onChange={e => setLevelFilter(e.target.value)}
                            className="border rounded-lg px-3 py-1.5 text-sm"
                        >
                            <option value="">Tous</option>
                            <option value="info">Info</option>
                            <option value="warn">Warning</option>
                            <option value="error">Error</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Source</label>
                        <select
                            value={sourceFilter}
                            onChange={e => setSourceFilter(e.target.value)}
                            className="border rounded-lg px-3 py-1.5 text-sm"
                        >
                            <option value="">Toutes</option>
                            <option value="chat">Chat</option>
                            <option value="webhook">Webhook</option>
                            <option value="stripe">Stripe</option>
                            <option value="scanner">Scanner</option>
                            <option value="auth">Auth</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Correlation ID</label>
                        <input
                            type="text"
                            value={cidFilter}
                            onChange={e => setCidFilter(e.target.value)}
                            placeholder="ayo_..."
                            className="border rounded-lg px-3 py-1.5 text-sm w-48"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Limite</label>
                        <select
                            value={limitFilter}
                            onChange={e => setLimitFilter(e.target.value)}
                            className="border rounded-lg px-3 py-1.5 text-sm"
                        >
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="200">200</option>
                            <option value="500">500</option>
                        </select>
                    </div>
                    <button
                        onClick={() => fetchLogs()}
                        disabled={loading}
                        className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                        style={{ background: '#4A919E' }}
                    >
                        {loading ? '...' : 'Rechercher'}
                    </button>
                    {cidFilter && (
                        <button
                            onClick={() => { setCidFilter(''); setTimeout(() => fetchLogs(), 50); }}
                            className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 text-gray-700"
                        >
                            Effacer CID
                        </button>
                    )}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Logs Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b" style={{ background: '#E2EFE9' }}>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Heure</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Niveau</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Source</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Step</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Message</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">CID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                                        Aucun log trouvé.
                                    </td>
                                </tr>
                            )}
                            {logs.map((log) => (
                                <tr
                                    key={log._id}
                                    className="border-b hover:bg-gray-50 cursor-pointer"
                                    onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                                >
                                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap font-mono">
                                        {formatTime(log.timestamp)}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${LEVEL_COLORS[log.level] || 'bg-gray-100'}`}>
                                            {log.level}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${SOURCE_COLORS[log.source] || 'bg-gray-100 text-gray-700'}`}>
                                            {log.source}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs font-mono text-gray-700 max-w-[180px] truncate">
                                        {log.step}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[300px] truncate">
                                        {log.message}
                                    </td>
                                    <td className="px-3 py-2">
                                        {log.correlation_id && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); filterByCid(log.correlation_id); }}
                                                className="text-xs font-mono text-teal-600 hover:underline truncate max-w-[120px] block"
                                                title={log.correlation_id}
                                            >
                                                {log.correlation_id.substring(0, 16)}...
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Expanded Detail */}
                    {expandedId && (() => {
                        const log = logs.find(l => l._id === expandedId);
                        if (!log) return null;
                        return (
                            <div className="border-t bg-gray-50 p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-sm" style={{ color: '#212E53' }}>
                                        {log.step}
                                    </h3>
                                    <button
                                        onClick={() => setExpandedId(null)}
                                        className="text-gray-400 hover:text-gray-600 text-xs"
                                    >
                                        Fermer
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                    <div><span className="text-gray-500">Timestamp:</span> {log.timestamp}</div>
                                    <div><span className="text-gray-500">Level:</span> {log.level}</div>
                                    <div><span className="text-gray-500">Source:</span> {log.source}</div>
                                    <div>
                                        <span className="text-gray-500">CID:</span>{' '}
                                        <span className="font-mono">{log.correlation_id}</span>
                                    </div>
                                </div>
                                <div className="text-xs mb-2">
                                    <span className="text-gray-500">Message:</span> {log.message}
                                </div>
                                {log.data && (
                                    <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-3 overflow-x-auto max-h-64">
                                        {JSON.stringify(log.data, null, 2)}
                                    </pre>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

function formatTime(ts: string): string {
    try {
        const d = new Date(ts);
        return d.toLocaleString('fr-CH', {
            day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch {
        return ts;
    }
}
