import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DeviceSelector } from './device-selector/device-selector';
import { DevicesList, type DevicesListNarrowing, EMPTY_DEVICES_NARROWING } from './devices-list';

const DEVICE = { id: 'd-1', machineId: 'm-1', status: 'ONLINE', hostname: 'macbook-pro', nickname: null };

function ControlledDevicesList() {
  const [narrowing, setNarrowing] = useState<DevicesListNarrowing>(EMPTY_DEVICES_NARROWING);
  return <DevicesList devices={[DEVICE]} narrowing={narrowing} onNarrowingChange={setNarrowing} />;
}

function pressEnterAfterTyping(text: string) {
  const input = screen.getByPlaceholderText<HTMLInputElement>('Search for Devices');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return input;
}

describe('Enter in the devices search', () => {
  it('keeps the text a search in DevicesList: no chip, and the box keeps its value', () => {
    render(<ControlledDevicesList />);
    const input = pressEnterAfterTyping('macbook');
    expect(input.value).toBe('macbook');
    expect(input.placeholder).toBe('Search for Devices');
  });

  it('keeps the text a search in DeviceSelector: no chip, and the box keeps its value', () => {
    render(<DeviceSelector devices={[DEVICE]} loading={false} showSelectionModeRadio={false} />);
    const input = pressEnterAfterTyping('macbook');
    expect(input.value).toBe('macbook');
    expect(input.placeholder).toBe('Search for Devices');
  });
});
