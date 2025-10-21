import React from 'react';

interface StatusIndicatorProps {
  label: string;
  status: 'ok' | 'warning' | 'error' | 'loading';
  lastUpdate?: string;
  errors?: number;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ label, status, lastUpdate, errors = 0 }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'ok': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'loading': return 'bg-blue-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ok': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      case 'loading': return '●';
      default: return '?';
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-3 h-3 rounded-full ${getStatusColor()} flex items-center justify-center text-white text-[10px] font-bold`}>
        {getStatusText()}
      </div>
      <span className="font-medium text-gray-700">{label}</span>
      {lastUpdate && (
        <span className="text-gray-500">
          {new Date(lastUpdate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {errors > 0 && (
        <span className="text-red-500 font-medium">({errors})</span>
      )}
    </div>
  );
};

interface StatusBarProps {
  transportStatus: StatusIndicatorProps['status'];
  transportLastUpdate?: string;
  transportErrors?: number;
  velibStatus: StatusIndicatorProps['status'];
  velibLastUpdate?: string;
  velibErrors?: number;
  newsStatus: StatusIndicatorProps['status'];
  newsLastUpdate?: string;
  newsErrors?: number;
  coursesStatus: StatusIndicatorProps['status'];
  coursesLastUpdate?: string;
  coursesErrors?: number;
  onRefresh: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  transportStatus, transportLastUpdate, transportErrors = 0,
  velibStatus, velibLastUpdate, velibErrors = 0,
  newsStatus, newsLastUpdate, newsErrors = 0,
  coursesStatus, coursesLastUpdate, coursesErrors = 0,
  onRefresh
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <StatusIndicator 
            label="Transports" 
            status={transportStatus} 
            lastUpdate={transportLastUpdate} 
            errors={transportErrors} 
          />
          <StatusIndicator 
            label="Vélib" 
            status={velibStatus} 
            lastUpdate={velibLastUpdate} 
            errors={velibErrors} 
          />
          <StatusIndicator 
            label="Actualités" 
            status={newsStatus} 
            lastUpdate={newsLastUpdate} 
            errors={newsErrors} 
          />
          <StatusIndicator 
            label="Courses" 
            status={coursesStatus} 
            lastUpdate={coursesLastUpdate} 
            errors={coursesErrors} 
          />
        </div>
        
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualiser
        </button>
      </div>
    </div>
  );
};