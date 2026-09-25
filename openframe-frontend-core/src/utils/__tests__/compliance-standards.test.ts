import { describe, expect, it } from 'vitest';
import { complianceStandardForName } from '../compliance-standards';

describe('complianceStandardForName', () => {
  it("reads a system's standard id and every common display spelling", () => {
    expect(complianceStandardForName('soc2')?.mark).toBe('SOC 2');
    expect(complianceStandardForName('SOC 2 Type II')?.key).toBe('soc2');
    expect(complianceStandardForName('ISO/IEC 27001:2022')?.key).toBe('iso27001');
    expect(complianceStandardForName('ISO 42001 (AI management)')?.key).toBe('iso42001');
    expect(complianceStandardForName('PCI DSS v4.0')?.key).toBe('pcidss');
  });

  it('the longest alias wins, so a longer ISO number never reads as a shorter one', () => {
    expect(complianceStandardForName('ISO 27017')?.key).toBe('iso27017');
    expect(complianceStandardForName('NIST SP 800-171')?.key).toBe('nist800171');
  });

  it('tries the names in order and answers null for an unknown standard', () => {
    expect(complianceStandardForName(null, 'HIPAA')?.key).toBe('hipaa');
    expect(complianceStandardForName('Internal policy')).toBeNull();
    expect(complianceStandardForName()).toBeNull();
  });
});
