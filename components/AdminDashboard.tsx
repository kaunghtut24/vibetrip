import React, { useState, useEffect } from 'react';
import { metrics } from '../services/metrics';

interface BackendMetrics {
  uptime: number;
  requests: {
    total: number;
    errors: number;
    errorRate: string;
  };
  gemini: {
    calls: number;
    errors: number;
    errorRate: string;
    avgDuration: string;
  };
  rateLimits: {
    global: Record<string, any>;
    gemini: Record<string, any>;
  };
  timestamp: string;
}

export const AdminDashboard: React.FC = () => {
  const [backendMetrics, setBackendMetrics] = useState<BackendMetrics | null>(null);
  const [frontendMetrics, setFrontendMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setBackendMetrics(data);
      setFrontendMetrics(metrics.getSummary());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
        <p className="text-red-800">Error loading metrics: {error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Backend Metrics */}
        {backendMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Uptime"
              value={formatUptime(backendMetrics.uptime)}
              icon="⏱️"
            />
            <MetricCard
              title="Total Requests"
              value={backendMetrics.requests.total.toString()}
              subtitle={`Error Rate: ${backendMetrics.requests.errorRate}`}
              icon="📊"
            />
            <MetricCard
              title="Gemini Calls"
              value={backendMetrics.gemini.calls.toString()}
              subtitle={`Avg: ${backendMetrics.gemini.avgDuration}`}
              icon="🤖"
            />
            <MetricCard
              title="Gemini Errors"
              value={backendMetrics.gemini.errors.toString()}
              subtitle={`Rate: ${backendMetrics.gemini.errorRate}`}
              icon="⚠️"
              alert={backendMetrics.gemini.errors > 0}
            />
          </div>
        )}

        {/* Rate Limits */}
        {backendMetrics && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Active Rate Limits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Global Rate Limiter</h3>
                <div className="text-sm text-gray-600">
                  Active IPs: {Object.keys(backendMetrics.rateLimits.global).length}
                </div>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Gemini Rate Limiter</h3>
                <div className="text-sm text-gray-600">
                  Active IPs: {Object.keys(backendMetrics.rateLimits.gemini).length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Frontend Metrics */}
        {frontendMetrics && Object.keys(frontendMetrics).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Frontend Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(frontendMetrics).map(([key, stats]: [string, any]) => (
                <div key={key} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">{key}</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Count: {stats.count}</div>
                    <div>Avg: {stats.avg?.toFixed(2)} {stats.unit}</div>
                    <div>Min: {stats.min} {stats.unit}</div>
                    <div>Max: {stats.max} {stats.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: string;
  alert?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, alert }) => (
  <div className={`bg-white rounded-lg shadow p-6 ${alert ? 'border-2 border-red-300' : ''}`}>
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      {icon && <span className="text-2xl">{icon}</span>}
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
  </div>
);

export default AdminDashboard;

