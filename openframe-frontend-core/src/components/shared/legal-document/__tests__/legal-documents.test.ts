import { describe, expect, it } from 'vitest';
import { legalDocumentStampLabel } from '../legal-document-page';
import { toLegalDocumentSummaries } from '../use-legal-documents';

describe('legalDocumentStampLabel', () => {
  it('states the version and the effective date a document carries', () => {
    expect(legalDocumentStampLabel({ version: '2.0', effectiveDate: 'October 14, 2026' })).toBe(
      'Version 2.0 · Effective October 14, 2026',
    );
  });

  it('states the one it has, and nothing for a document that states neither', () => {
    expect(legalDocumentStampLabel({ version: '1.0', effectiveDate: null })).toBe('Version 1.0');
    expect(legalDocumentStampLabel({ version: null, effectiveDate: null })).toBeNull();
    expect(legalDocumentStampLabel(null)).toBeNull();
  });
});

describe('toLegalDocumentSummaries', () => {
  it('reads the list the hub serves', () => {
    expect(
      toLegalDocumentSummaries({
        documents: [
          {
            docType: 'terms',
            title: 'Terms of Service',
            summary: 'The agreement for using OpenFrame and our websites.',
            route: '/terms-of-service',
            sourceFile: 'TERMS.md',
            version: '1.0',
            effectiveDate: 'October 14, 2026',
            published: true,
          },
          { docType: 'payment', title: 'Payment Terms', published: false },
        ],
      }),
    ).toEqual([
      {
        docType: 'terms',
        title: 'Terms of Service',
        summary: 'The agreement for using OpenFrame and our websites.',
        route: '/terms-of-service',
        sourceFile: 'TERMS.md',
        version: '1.0',
        effectiveDate: 'October 14, 2026',
        published: true,
      },
      {
        docType: 'payment',
        title: 'Payment Terms',
        summary: '',
        route: '',
        sourceFile: '',
        version: null,
        effectiveDate: null,
        published: false,
      },
    ]);
  });

  it('leaves out a row with no type or title, and answers nothing for another shape', () => {
    expect(toLegalDocumentSummaries({ documents: [{ title: 'No type' }, null, 'x'] })).toEqual([]);
    expect(toLegalDocumentSummaries(null)).toEqual([]);
    expect(toLegalDocumentSummaries({ documents: 'nope' })).toEqual([]);
  });
});
