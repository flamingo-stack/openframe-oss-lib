import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DashboardInfoCard } from '../dashboard-info-card';

describe('DashboardInfoCard loading', () => {
  it('keeps the real title while the figure loads', () => {
    const html = renderToString(<DashboardInfoCard loading title="Storage Used" value="" />);
    expect(html).toContain('Storage Used');
  });

  it('keeps a titleSlot while the figure loads', () => {
    const html = renderToString(<DashboardInfoCard loading titleSlot={<b>Slot title</b>} value="" />);
    expect(html).toContain('Slot title');
  });

  it('holds the progress ring when showProgress is set, with no percentage yet', () => {
    const html = renderToString(<DashboardInfoCard loading showProgress title="Storage" value="" />);
    expect(html).toContain('rounded-full');
    expect(html).not.toContain('<svg');
  });

  it('holds the percentage only when loadingShowsPercentage is set', () => {
    const without = renderToString(<DashboardInfoCard loading title="Storage" value="" />);
    const withIt = renderToString(<DashboardInfoCard loading loadingShowsPercentage title="Storage" value="" />);
    expect(withIt.match(/animate-pulse/g)?.length).toBe((without.match(/animate-pulse/g)?.length ?? 0) + 1);
  });

  it('holds the sub-value only when loadingShowsSubValue is set', () => {
    const without = renderToString(<DashboardInfoCard loading title="Logs" value="" />);
    const withIt = renderToString(<DashboardInfoCard loading loadingShowsSubValue title="Logs" value="" />);
    expect(withIt.match(/animate-pulse/g)?.length).toBe((without.match(/animate-pulse/g)?.length ?? 0) + 1);
  });

  it('marks the card busy while loading and announces nothing of its own', () => {
    const html = renderToString(<DashboardInfoCard loading title="Storage" value="" />);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('role="status"');
    expect(renderToString(<DashboardInfoCard title="Storage" value="1" />)).not.toContain('aria-busy');
  });

  it('draws a title bar only when there is no title', () => {
    const html = renderToString(<DashboardInfoCard loading value="" />);
    expect(html.match(/animate-pulse/g)?.length).toBe(2);
  });
});
