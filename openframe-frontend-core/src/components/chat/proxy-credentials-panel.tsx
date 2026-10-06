'use client';

/**
 * The `/debug` paste-credentials panel — THE one form for the chat-proxy header
 * contract, shared by the hub's admin `/debug` and the embedding example's.
 *
 * Every field is one header: the API key (`Authorization: Bearer`), the act-as
 * email (`X-Chat-Act-As`), and every row of `EMBED_PROXY_OPTIONAL_HEADERS` —
 * the acting user's display identity and the visitor context a gateway forwards
 * (origin page, IP, country, visitor id; the hub honours those only from a
 * SERVICE key). Values persist through `setEmbedProxyAuth`, and every embedded
 * surface attaches them through `applyProxyAuth`. The preview shows the exact
 * headers the next request carries, from the form as typed.
 */

import { type ReactNode, useMemo, useState } from 'react';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import {
  clearEmbedProxyAuth,
  EMBED_PROXY_OPTIONAL_HEADERS,
  type EmbedProxyAuth,
  type EmbedProxyOptionalField,
  getEmbedProxyAuth,
  setEmbedProxyAuth,
} from '../../utils/embed-proxy-auth-storage';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Field } from '../ui/field';
import { Input } from '../ui/input';
import { StatusBadge } from '../ui/status-badge';

type OptionalValues = Partial<Record<EmbedProxyOptionalField, string>>;

interface OptionalFieldCopy {
  label: string;
  placeholder: string;
  hint: string;
  type?: 'email' | 'text' | 'url';
  /** Returns an error message, or null when the (non-empty) value is acceptable. */
  validate?: (value: string) => string | null;
}

const httpsOnly = (label: string) => (value: string) =>
  /^https:\/\//i.test(value) ? null : `${label} must start with https://`;

/** Keyed by field, so a header added to `EMBED_PROXY_OPTIONAL_HEADERS` does not compile without its copy. */
const OPTIONAL_FIELD_COPY: Record<EmbedProxyOptionalField, OptionalFieldCopy> = {
  avatarUrl: {
    hint: 'Avatar shown for the acting user.',
    label: 'Avatar URL',
    placeholder: 'https://…/avatar.png',
    type: 'url',
    validate: httpsOnly('Avatar URL'),
  },
  country: {
    hint: 'ISO country code of the visitor. The hub currently ignores it and derives the country from the forwarded IP.',
    label: 'Country',
    placeholder: 'US',
    validate: value => (/^[A-Za-z]{2}$/.test(value) ? null : 'Country must be a two-letter ISO code'),
  },
  firstName: { hint: 'Display name of the acting user.', label: 'First name', placeholder: 'Jane' },
  ip: {
    hint: 'The visitor IP a gateway forwards; keeps rate limits per visitor.',
    label: 'Visitor IP',
    placeholder: '203.0.113.4',
  },
  lastName: { hint: 'Display name of the acting user.', label: 'Last name', placeholder: 'Doe' },
  originUrl: {
    hint: 'The page the chat is opened on. An OpenFrame app origin (e.g. https://acme.openframe.ai) makes answers link that app’s screens.',
    label: 'Origin URL',
    placeholder: 'https://acme.openframe.ai',
    type: 'url',
    validate: value =>
      /^https:\/\//i.test(value) || /^http:\/\/localhost(:\d+)?(\/|$)/i.test(value)
        ? null
        : 'Origin URL must start with https:// (or http://localhost)',
  },
  visitorId: {
    hint: 'A stable per-visitor id a gateway forwards; the anonymous identity when no IP is attributable.',
    label: 'Visitor ID',
    placeholder: 'visitor-42',
  },
};

const GROUPS = [
  {
    description: 'Shown as the acting user in the chat.',
    id: 'identity',
    title: 'Identity',
  },
  {
    description: 'What a gateway forwards about the visitor. Honoured only from a SERVICE key.',
    id: 'visitor',
    title: 'Visitor context',
  },
] as const;

/** A key as it may be shown: its `fpk_<platform>_` prefix and last four characters, never the secret between. */
function maskKey(key: string): string {
  const prefix = /^fpk_[a-z0-9-]+_/i.exec(key)?.[0] ?? '';
  return key.length - prefix.length <= 8 ? `${prefix}••••` : `${prefix}…${key.slice(-4)}`;
}

function HeaderName({ children }: { children: ReactNode }) {
  return <code className="font-mono text-ods-text-secondary text-h6">{children}</code>;
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-[var(--spacing-system-sf)]">
      <div>
        <h3 className="text-ods-text-primary text-h4">{title}</h3>
        <p className="text-ods-text-secondary text-h6">{description}</p>
      </div>
      {children}
    </section>
  );
}

export interface ProxyCredentialsPanelProps {
  /** One line on where the credentials apply, under the panel title. */
  description?: ReactNode;
}

/**
 * The saved credentials live in `localStorage`, which neither the server nor the
 * hydration pass can read, so the form is seeded from storage once the page has
 * hydrated (a remount, keyed by the gate) rather than by a state write in an effect.
 */
export function ProxyCredentialsPanel({ description }: ProxyCredentialsPanelProps) {
  const hydrated = useIsHydrated();
  return (
    <ProxyCredentialsForm
      key={hydrated ? 'stored' : 'server'}
      description={description}
      saved={hydrated ? getEmbedProxyAuth() : null}
    />
  );
}

function ProxyCredentialsForm({ description, saved }: ProxyCredentialsPanelProps & { saved: EmbedProxyAuth | null }) {
  const { secret: savedSecret, email: savedEmail, ...savedOptional } = saved ?? { email: '', secret: '' };
  const [secret, setSecret] = useState('');
  const [email, setEmail] = useState(savedEmail);
  const [optional, setOptional] = useState<OptionalValues>(savedOptional);
  const [savedKeyTail, setSavedKeyTail] = useState<string | null>(savedSecret ? maskKey(savedSecret) : null);
  const [activeEmail, setActiveEmail] = useState<string | null>(savedEmail || null);
  const [status, setStatus] = useState('');

  const errors = useMemo(() => {
    const out: OptionalValues = {};
    for (const { field } of EMBED_PROXY_OPTIONAL_HEADERS) {
      const value = optional[field]?.trim();
      const message = value ? OPTIONAL_FIELD_COPY[field].validate?.(value) : null;
      if (message) out[field] = message;
    }
    return out;
  }, [optional]);

  const hasErrors = Object.keys(errors).length > 0;
  const keyForPreview = secret.trim() ? maskKey(secret.trim()) : savedKeyTail;
  const canSave = !!email.trim() && (!!secret.trim() || !!savedKeyTail) && !hasErrors;

  const preview: [string, string][] = [
    ...(keyForPreview ? [['Authorization', `Bearer ${keyForPreview}`] as [string, string]] : []),
    ...(email.trim() ? [['X-Chat-Act-As', email.trim().toLowerCase()] as [string, string]] : []),
    ...EMBED_PROXY_OPTIONAL_HEADERS.flatMap(({ field, header }) => {
      const value = optional[field]?.trim();
      return value ? [[header, value] as [string, string]] : [];
    }),
  ];

  const save = () => {
    const key = secret.trim() || getEmbedProxyAuth()?.secret;
    const actAs = email.trim().toLowerCase();
    if (!key || !actAs || hasErrors) {
      setStatus(hasErrors ? 'Fix the highlighted fields first.' : 'API key and act-as email are required.');
      return;
    }
    setEmbedProxyAuth({ email: actAs, secret: key, ...optional });
    setActiveEmail(actAs);
    setSavedKeyTail(maskKey(key));
    setSecret('');
    setStatus(`Saved. Requests now act as ${actAs}.`);
  };

  const clear = () => {
    clearEmbedProxyAuth();
    setActiveEmail(null);
    setSavedKeyTail(null);
    setSecret('');
    setEmail('');
    setOptional({});
    setStatus('Cleared. Requests use the session again.');
  };

  const setField = (field: EmbedProxyOptionalField, value: string) =>
    setOptional(prev => ({ ...prev, [field]: value }));

  return (
    <Card>
      <CardContent className="space-y-[var(--spacing-system-lf)] p-[var(--spacing-system-mf)]">
        <header className="flex flex-col gap-[var(--spacing-system-sf)] sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-ods-text-primary text-h3">Proxy credentials</h2>
            {description && <p className="text-ods-text-secondary text-h6">{description}</p>}
          </div>
          {activeEmail && (
            <div className="self-start">
              <StatusBadge singleLine colorScheme="success" text={`Active: ${activeEmail}`} />
            </div>
          )}
        </header>

        <Section
          title="Credentials"
          description="A platform API key minted in /admin/api-keys for this platform, and the user to act as."
        >
          <div className="grid grid-cols-1 gap-[var(--spacing-system-sf)] md:grid-cols-2">
            <Field
              label="Platform API key"
              required
              hint="A SERVICE key may act as anyone; a personal key only as its owner."
              labelEnd={<HeaderName>Authorization</HeaderName>}
            >
              {props => (
                <Input
                  {...props}
                  type="password"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder={savedKeyTail ? `${savedKeyTail} (saved; paste to replace)` : 'fpk_...'}
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </Field>
            <Field
              label="Act as"
              required
              hint="The end user the requests run as."
              labelEnd={<HeaderName>X-Chat-Act-As</HeaderName>}
            >
              {props => (
                <Input
                  {...props}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </Field>
          </div>
        </Section>

        {GROUPS.map(group => (
          <Section key={group.id} title={group.title} description={group.description}>
            <div className="grid grid-cols-1 gap-[var(--spacing-system-sf)] md:grid-cols-2">
              {EMBED_PROXY_OPTIONAL_HEADERS.filter(row => row.group === group.id).map(({ field, header }) => {
                const copy = OPTIONAL_FIELD_COPY[field];
                return (
                  <Field
                    key={field}
                    label={copy.label}
                    hint={copy.hint}
                    error={errors[field] ?? null}
                    labelEnd={<HeaderName>{header}</HeaderName>}
                  >
                    {props => (
                      <Input
                        {...props}
                        type={copy.type ?? 'text'}
                        value={optional[field] ?? ''}
                        onChange={e => setField(field, e.target.value)}
                        placeholder={copy.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          </Section>
        ))}

        <Section title="Headers sent" description="What the next chat or MCP request carries, from the form as typed.">
          <div className="rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)]">
            {preview.length ? (
              <dl className="space-y-[var(--spacing-system-xxs)] font-mono text-h6">
                {preview.map(([name, value]) => (
                  <div key={name} className="flex flex-wrap gap-x-[var(--spacing-system-xsf)]">
                    <dt className="text-ods-text-secondary">{name}:</dt>
                    <dd className="break-all text-ods-text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-ods-text-secondary text-h6">No proxy headers: requests use the session.</p>
            )}
          </div>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-[var(--spacing-system-sf)]">
          <span className="text-ods-text-secondary text-h6">{status}</span>
          <div className="flex gap-[var(--spacing-system-xsf)]">
            <Button variant="outline" onClick={clear} disabled={!activeEmail && !secret && !email}>
              Clear
            </Button>
            <Button onClick={save} disabled={!canSave}>
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
