import React, { useState } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { AppConfig } from '../types';
import { testConnection, connectDatabase, switchDemoMode } from '../services/api';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onConnectionUpdated: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  config,
  onConnectionUpdated,
}) => {
  if (!isOpen) return null;

  const [host, setHost] = useState(config?.falkordb_host && config.falkordb_host !== 'None (Demo Mode)' ? config.falkordb_host : '');
  const [port, setPort] = useState(config?.falkordb_port || 6379);
  const [username, setUsername] = useState(config?.falkordb_username || 'default');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(config?.falkordb_ssl || false);
  const [graphName, setGraphName] = useState(config?.falkordb_graph || 'orgmind_demo');

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection({
        host,
        port: Number(port),
        username,
        password,
        ssl,
        graph_name: graphName,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    try {
      const res = await connectDatabase({
        host,
        port: Number(port),
        username,
        password,
        ssl,
        graph_name: graphName,
      });
      if (res.success) {
        onConnectionUpdated();
        onClose();
      } else {
        setTestResult({ success: false, error: res.error || 'Failed to connect.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSwitchDemo = async () => {
    try {
      await switchDemoMode();
      onConnectionUpdated();
      onClose();
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={20} color="var(--accent-indigo)" />
            <h3>FalkorDB Connection Settings</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Info Banner */}
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 8,
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#FFFFFF', marginBottom: 4 }}>
            <ShieldCheck size={14} color="var(--accent-emerald)" />
            <span>FalkorDB Cloud Setup</span>
          </div>
          OrgMind connects directly to your FalkorDB Cloud or local Redis instance via Cypher. If you don't have connection credentials ready, you can continue exploring with the embedded Zero-Config Demo Mode.
        </div>

        <form onSubmit={handleConnect}>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Host / Endpoint</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. your-db.falkordb.cloud or localhost"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Port</label>
              <input
                type="number"
                className="form-input"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="default"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="FalkorDB Cloud password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Graph Name / Database Key</label>
              <input
                type="text"
                className="form-input"
                value={graphName}
                onChange={(e) => setGraphName(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 16 }}>
                <input
                  type="checkbox"
                  checked={ssl}
                  onChange={(e) => setSsl(e.target.checked)}
                />
                <span>Enable SSL/TLS</span>
              </label>
            </div>
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: testResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: testResult.success ? 'var(--accent-emerald)' : '#FCA5A5',
              }}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.success ? testResult.message : testResult.error}</span>
            </div>
          )}

          {/* Modal Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSwitchDemo}
            >
              Use Demo Mode
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleTest}
                disabled={isTesting || !host}
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isConnecting || !host}
              >
                {isConnecting ? 'Connecting...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
