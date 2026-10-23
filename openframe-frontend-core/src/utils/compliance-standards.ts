/**
 * Compliance standards — THE vocabulary behind a framework's logo. Each entry
 * names the standard's issuing body and the short mark the badge prints
 * (`ComplianceBadge`), plus the spellings a system may use for it (Vanta's
 * `standard` field is `soc2`; its display name is "SOC 2"; a Trust Center
 * editor may write "SOC 2 Type II"). Server-safe, no React.
 *
 * `logo` names the OFFICIAL mark shipped in the icon set
 * (`icons-v2/compliance-logos`): ISO's emblem, the ISO/IEC emblem of the joint
 * standards, the EU emblem for EU regulations and HHS for HIPAA (Wikimedia
 * Commons, public domain); the AICPA SOC 2 seal, vectorised from the seal the
 * company supplied (AICPA licenses it to companies holding a SOC 2 report with
 * an unqualified opinion); and the NIST and CMMC round marks the company
 * supplied, single-colour and drawn in the text colour. A standard without a
 * mark shows our drawn `ComplianceBadge` instead.
 */

/** The official marks the icon set ships (`icons-v2/compliance-logos`). */
export type ComplianceLogoKey = 'aicpa-soc2' | 'iso' | 'iso-iec' | 'nist' | 'cmmc' | 'eu' | 'hhs';
export interface ComplianceStandard {
  /** Stable key, e.g. `soc2`. */
  key: string;
  /** The issuing body, printed small on the badge ring, e.g. "AICPA". */
  body: string;
  /** The mark printed large, e.g. "SOC 2". */
  mark: string;
  /** Folded spellings (lowercase letters + digits) a name may start with. */
  aliases: readonly string[];
  /** Its official mark in the icon set, when one ships. */
  logo?: ComplianceLogoKey;
}

export const COMPLIANCE_STANDARDS: readonly ComplianceStandard[] = [
  { key: 'soc1', body: 'AICPA', mark: 'SOC 1', aliases: ['soc1', 'ssae18'] },
  { key: 'soc2', body: 'AICPA', mark: 'SOC 2', aliases: ['soc2'], logo: 'aicpa-soc2' },
  { key: 'soc3', body: 'AICPA', mark: 'SOC 3', aliases: ['soc3'] },
  { key: 'iso27001', body: 'ISO', mark: '27001', aliases: ['iso27001', 'isoiec27001'], logo: 'iso-iec' },
  { key: 'iso27017', body: 'ISO', mark: '27017', aliases: ['iso27017', 'isoiec27017'], logo: 'iso-iec' },
  { key: 'iso27018', body: 'ISO', mark: '27018', aliases: ['iso27018', 'isoiec27018'], logo: 'iso-iec' },
  { key: 'iso27701', body: 'ISO', mark: '27701', aliases: ['iso27701', 'isoiec27701'], logo: 'iso-iec' },
  { key: 'iso42001', body: 'ISO', mark: '42001', aliases: ['iso42001', 'isoiec42001'], logo: 'iso-iec' },
  { key: 'iso9001', body: 'ISO', mark: '9001', aliases: ['iso9001'], logo: 'iso' },
  { key: 'gdpr', body: 'EU', mark: 'GDPR', aliases: ['gdpr'], logo: 'eu' },
  { key: 'euaiact', body: 'EU', mark: 'AI ACT', aliases: ['euaiact', 'aiact'], logo: 'eu' },
  { key: 'nis2', body: 'EU', mark: 'NIS2', aliases: ['nis2'], logo: 'eu' },
  { key: 'dora', body: 'EU', mark: 'DORA', aliases: ['dora'], logo: 'eu' },
  { key: 'hipaa', body: 'HHS', mark: 'HIPAA', aliases: ['hipaa'], logo: 'hhs' },
  { key: 'pcidss', body: 'PCI', mark: 'DSS', aliases: ['pcidss', 'pci'] },
  { key: 'nistcsf', body: 'NIST', mark: 'CSF', aliases: ['nistcsf', 'nistcybersecurityframework'], logo: 'nist' },
  { key: 'nist80053', body: 'NIST', mark: '800-53', aliases: ['nist80053', 'nistsp80053'], logo: 'nist' },
  { key: 'nist800171', body: 'NIST', mark: '800-171', aliases: ['nist800171', 'nistsp800171'], logo: 'nist' },
  { key: 'fedramp', body: 'US GOV', mark: 'FedRAMP', aliases: ['fedramp'] },
  { key: 'cmmc', body: 'DoD', mark: 'CMMC', aliases: ['cmmc'], logo: 'cmmc' },
  { key: 'ccpa', body: 'CA', mark: 'CCPA', aliases: ['ccpa', 'cpra'] },
  { key: 'hitrust', body: 'HITRUST', mark: 'CSF', aliases: ['hitrust'] },
  { key: 'csastar', body: 'CSA', mark: 'STAR', aliases: ['csastar', 'star'] },
  { key: 'cyberessentials', body: 'NCSC', mark: 'CE', aliases: ['cyberessentials'] },
  { key: 'tisax', body: 'ENX', mark: 'TISAX', aliases: ['tisax'] },
];

/** Folds a name to compare spellings: "SOC 2 Type II" → `soc2typeii`, "ISO/IEC 27001:2022" → `isoiec270012022`. */
function foldStandardName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The standard whose alias `folded` starts with — the longest alias wins — or null. */
function standardForFolded(folded: string): ComplianceStandard | null {
  let bestStandard: ComplianceStandard | null = null;
  let bestLength = 0;
  for (const standard of COMPLIANCE_STANDARDS) {
    for (const alias of standard.aliases) {
      if (folded.startsWith(alias) && alias.length > bestLength) {
        bestStandard = standard;
        bestLength = alias.length;
      }
    }
  }
  return bestStandard;
}

/**
 * THE standard a framework name (or a system's standard id) names, or `null`.
 * The folded name must START with an alias; the longest alias wins, so
 * "SOC 2 Type II" is SOC 2 and "ISO 27017" never reads as a shorter ISO key.
 */
export function complianceStandardForName(
  ...names: ReadonlyArray<string | null | undefined>
): ComplianceStandard | null {
  for (const name of names) {
    const folded = foldStandardName(name ?? '');
    const standard = folded ? standardForFolded(folded) : null;
    if (standard) return standard;
  }
  return null;
}
