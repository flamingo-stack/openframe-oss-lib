import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnalyzingState } from '../analyzing-state';
import { IncidentFeed } from '../incident-feed';

const LABELS = { working: 'Fixing', waiting: 'Needs you', fixed: 'Fixed', approved: 'Approved' };

describe('AnalyzingState', () => {
  it('announces its label as a status', () => {
    render(<AnalyzingState label="Mingo is analyzing your logs" />);
    expect(screen.getByRole('status')).toHaveTextContent('Mingo is analyzing your logs');
  });

  it('is what an empty incident feed shows, and leaves once there is an incident', () => {
    const { rerender } = render(<IncidentFeed items={[]} statusLabels={LABELS} emptyLabel="Reading logs" />);
    expect(screen.getByRole('status')).toHaveTextContent('Reading logs');
    rerender(
      <IncidentFeed
        items={[{ id: 'a', title: 'Firewall off', status: 'working' }]}
        statusLabels={LABELS}
        emptyLabel="Reading logs"
      />,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
