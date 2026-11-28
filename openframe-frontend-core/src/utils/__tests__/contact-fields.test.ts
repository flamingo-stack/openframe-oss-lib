import { describe, expect, it } from 'vitest';
import {
  CONTACT_FIELDS,
  contactToHubspot,
  HUBSPOT_CONTACT_PROPERTY_OF,
  hubspotToContact,
  splitName,
} from '../contact-fields';

describe('the contact contract', () => {
  it('turns every contact field into a HubSpot property and back without losing one', () => {
    const fields = {
      full_name: 'Ana Linares',
      job_title: 'COO',
      linkedin_url: 'https://www.linkedin.com/in/ana',
      company: 'Lake Dental',
      company_size: '51-200',
      website: 'lakedental.com',
      phone: '555',
      country: 'United States',
      mobile: '556',
      personal_email: 'ana@gmail.com',
      city: 'Tampa',
      zip: '33601',
    };
    expect(Object.keys(fields).sort()).toEqual([...CONTACT_FIELDS].sort());
    const hubspot = contactToHubspot(fields);
    expect(hubspot).toMatchObject({
      firstname: 'Ana',
      lastname: 'Linares',
      jobtitle: 'COO',
      mobilephone: '556',
      personal_email: 'ana@gmail.com',
    });
    expect(hubspot).not.toHaveProperty('job_title');
    expect(hubspotToContact(hubspot)).toEqual(fields);
  });

  it('names a HubSpot property for every field but the full name', () => {
    const mapped = Object.keys(HUBSPOT_CONTACT_PROPERTY_OF)
      .filter(k => k !== 'email')
      .sort();
    expect(mapped).toEqual(CONTACT_FIELDS.filter(f => f !== 'full_name').sort());
  });

  it('splits a full name into first and last', () => {
    expect(splitName('Mary Ann de Souza')).toEqual({ firstname: 'Mary', lastname: 'Ann de Souza' });
    expect(splitName('')).toEqual({ firstname: undefined, lastname: undefined });
  });
});

describe('the company contract', () => {
  it('labels every company field, and edits every field but the page a shared inbox was read on', async () => {
    const { COMPANY_FIELDS, COMPANY_FIELD_LABELS, COMPANY_EDITABLE_FIELDS } = await import('../contact-fields');
    expect(Object.keys(COMPANY_FIELD_LABELS).sort()).toEqual([...COMPANY_FIELDS].sort());
    expect(COMPANY_EDITABLE_FIELDS).toEqual(COMPANY_FIELDS.filter(f => f !== 'shared_inbox_source'));
    expect(COMPANY_FIELDS).toContain('naics_code');
  });
});
