import { useCallback, useMemo, useState } from 'react';
import { matchesDeviceName } from '../device-name';
import type { DeviceRow } from '../types';
import type { SubTab } from './device-selector.types';

interface UseDeviceSelectorParams<T extends DeviceRow> {
  devices: T[];
  selectedIds: Set<string>;
  getDeviceKey: (device: T) => string | undefined;
}

export function useDeviceSelector<T extends DeviceRow>({
  devices,
  selectedIds,
  getDeviceKey,
}: UseDeviceSelectorParams<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('available');

  const filteredDevices = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return devices;
    return devices.filter(
      d => matchesDeviceName(d, needle) || (d.osType || d.operating_system || '').toLowerCase().includes(needle),
    );
  }, [devices, searchTerm]);

  const displayDevices = useMemo(() => {
    if (activeSubTab === 'selected') {
      return filteredDevices.filter(d => {
        const key = getDeviceKey(d);
        return key !== undefined && selectedIds.has(key);
      });
    }
    return filteredDevices;
  }, [filteredDevices, activeSubTab, selectedIds, getDeviceKey]);

  const handleTabChange = useCallback((tabId: string) => {
    setSearchTerm('');
    setActiveSubTab(tabId as SubTab);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    activeSubTab,
    handleTabChange,
    filteredDevices,
    displayDevices,
  };
}
