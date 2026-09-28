import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComplianceLogo } from '../compliance-badge';

describe('ComplianceLogo', () => {
  it("an official mark fills its frame, so the caller's size class sizes the mark too", () => {
    render(<ComplianceLogo names={['soc2']} className="size-6" />);
    const frame = screen.getByRole('img', { name: 'AICPA SOC 2' });
    expect(frame).toHaveClass('size-6');
    expect(frame).toContainHTML('class="size-full"');
  });

  it("a drawn badge takes the caller's size class on the svg itself", () => {
    render(<ComplianceLogo names={['FedRAMP']} className="size-6" />);
    expect(screen.getByRole('img', { name: 'US GOV FedRAMP' })).toHaveClass('size-6');
  });

  it('an unknown standard shows the fallback', () => {
    render(<ComplianceLogo names={['Something else']} fallback={<span>fallback</span>} />);
    expect(screen.getByText('fallback')).toBeInTheDocument();
  });
});
