'use client';

import { useState } from 'react';
import { z } from 'zod';
import { type BlockedSenderKind, blockedSendersUrl } from '../../../types/blocked-senders';
import { isGenericDomain } from '../../../utils/generic-domain-utils';
import { validateEmailDomain } from '../../../utils/validation-utils';
import { AdminFormModal } from '../../ui/admin-form-modal';
import { FieldWrapper } from '../../ui/field-wrapper';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { BLOCKED_SENDER_KIND_COPY, REASON_LABEL, REASON_PLACEHOLDER } from './blocked-senders-presentation';
import { sendBlockedSendersWrite } from './blocked-senders-write';

const REASON_MAX = 500;
const ADDRESS = z.string().email().max(254);

export interface BlockSenderModalProps {
  /** Base of the host's blocked-senders routes, as `BlockedSendersPage` takes it. */
  endpoint: string;
  /** What the modal blocks: a whole domain, or one address. */
  kind: BlockedSenderKind;
  isOpen: boolean;
  onClose: () => void;
  /** It was blocked: the host bumps `BlockedSendersPage`'s `refreshKey`. */
  onBlocked: () => void;
}

/**
 * Block one domain or one address, always with a reason: the admin modal a host opens from its page header. The
 * value is checked as the rest of the lib checks it (`validateEmailDomain` for a domain, an email schema for an
 * address), and a shared mail provider (gmail.com) is refused as a domain, since blocking it would block everyone on it.
 */
export function BlockSenderModal({ endpoint, kind, isOpen, onClose, onBlocked }: BlockSenderModalProps) {
  const copy = BLOCKED_SENDER_KIND_COPY[kind];
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Closing (saved or not) empties the form, so the next opening starts clean.
  const close = () => {
    setValue('');
    setReason('');
    setTouched(false);
    onClose();
  };

  const checked = checkValue(kind, value);
  const valueError = touched && value.trim() !== '' ? checked.error : undefined;
  const canSave = !saving && checked.value !== null && reason.trim() !== '';

  const save = async () => {
    setTouched(true);
    if (!canSave || checked.value === null) return;
    const target = checked.value;
    setSaving(true);
    const ok = await sendBlockedSendersWrite({
      url: blockedSendersUrl(endpoint, kind === 'domain' ? 'domains' : 'emails'),
      method: 'POST',
      body: { value: target, reason: reason.trim() },
      success: `Blocked ${target}.`,
      failure: `Could not block ${target}`,
    });
    setSaving(false);
    if (!ok) return;
    onBlocked();
    close();
  };

  return (
    <AdminFormModal
      title={copy.blockLabel}
      subtitle={copy.hint}
      isOpen={isOpen}
      onClose={close}
      onSave={() => void save()}
      saveLabel={copy.blockLabel}
      canSave={canSave}
      saving={saving}
      dirty={value.trim() !== '' || reason.trim() !== ''}
      dirtyDetail={kind}
    >
      <div className="grid grid-cols-1 gap-[var(--spacing-system-m)]">
        <FieldWrapper label={copy.fieldLabel} htmlFor="block-sender-value" error={valueError}>
          <Input
            id="block-sender-value"
            placeholder={copy.placeholder}
            value={value}
            onChange={event => setValue(event.target.value)}
            onBlur={() => setTouched(true)}
            disabled={saving}
            autoComplete="off"
            required
            userValue
          />
        </FieldWrapper>
        <FieldWrapper label={REASON_LABEL} htmlFor="block-sender-reason">
          <Textarea
            id="block-sender-reason"
            placeholder={REASON_PLACEHOLDER}
            value={reason}
            onChange={event => setReason(event.target.value)}
            maxLength={REASON_MAX}
            disabled={saving}
            required
          />
        </FieldWrapper>
      </div>
    </AdminFormModal>
  );
}

/** The value to block, cleaned, or why it cannot be blocked. */
function checkValue(kind: BlockedSenderKind, raw: string): { value: string | null; error?: string } {
  const text = raw.trim();
  if (!text) return { value: null };
  if (kind === 'address') {
    return ADDRESS.safeParse(text).success
      ? { value: text.toLowerCase() }
      : { value: null, error: 'Enter one email address (e.g., spammer@gmail.com)' };
  }
  const domain = validateEmailDomain(text);
  if (!domain.valid || !domain.cleanedDomain) return { value: null, error: domain.error };
  if (isGenericDomain(domain.cleanedDomain)) {
    return {
      value: null,
      error: `${domain.cleanedDomain} is a shared email provider: block the address on the Emails tab instead`,
    };
  }
  return { value: domain.cleanedDomain };
}
