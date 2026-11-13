import React, { useEffect, useState } from 'react';
import { SystemInfo } from '../types/electron';
import { API_BASE_URL } from '../services/apiService';

export const StatusFooter: React.FC = () => {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    if (window.electronAPI?.getSystemInfo) {
      window.electronAPI.getSystemInfo().then(setSysInfo).catch(() => null);
    }
  }, []);

  return (
    <footer className="footer-bar">
      <div className="footer-left">
        <span>Electron: {sysInfo?.electronVersion || '30.0.0 (Preload)'}</span>
        <span>Chrome: {sysInfo?.chromeVersion || '124.0'}</span>
        <span>Platform: {sysInfo?.platform || 'win32'} ({sysInfo?.arch || 'x64'})</span>
      </div>

      <div>
        <span>API Target: {API_BASE_URL}</span>
      </div>
    </footer>
  );
};
