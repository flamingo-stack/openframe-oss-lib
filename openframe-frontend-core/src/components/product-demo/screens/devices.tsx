'use client';

import { useMemo } from 'react';
import { useProductDemoCast } from '../cast';
import { buildWindowsDevicesFixture } from '../fixtures/devices';
import type { ProductScreenViewProps } from '../types';
import { DevicesScreenView } from './devices-view';

/** The product's Devices page answering a search (`DevicesScreenView`), fed by its fixture. */
export default function DevicesScreen({ compact = false }: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildWindowsDevicesFixture(cast), [cast]);
  return (
    <DevicesScreenView
      compact={compact}
      devices={fixture.devices}
      deviceFilters={fixture.deviceFilters}
      totalCount={fixture.totalCount}
    />
  );
}
