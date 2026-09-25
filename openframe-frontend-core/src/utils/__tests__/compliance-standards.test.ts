import { describe, expect, it } from 'vitest';
import { COMPLIANCE_STANDARDS, complianceStandardForName } from '../compliance-standards';

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

describe('official logos', () => {
  it('each standard names the official mark the icon set ships, where one exists', () => {
    expect(complianceStandardForName('ISO 27001')?.logo).toBe('iso-iec');
    expect(complianceStandardForName('ISO 42001')?.logo).toBe('iso-iec');
    expect(complianceStandardForName('ISO 9001')?.logo).toBe('iso');
    expect(complianceStandardForName('GDPR')?.logo).toBe('eu');
    expect(complianceStandardForName('HIPAA')?.logo).toBe('hhs');
    expect(complianceStandardForName('NIST CSF')?.logo).toBe('nist');
  });

  it('SOC keeps the drawn badge: the AICPA seal is issued only through its logo program', () => {
    expect(COMPLIANCE_STANDARDS.filter(s => s.key.startsWith('soc')).every(s => s.logo === undefined)).toBe(true);
  });
});
