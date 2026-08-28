/**
 * ODS Current Color Token Test Component
 *
 * This component demonstrates that the ods-current token properly adapts
 * to different platform types (OpenFrame, Flamingo, TMCG).
 *
 * Expected behavior:
 * - OpenFrame: Cyan (#5efaf0)
 * - Flamingo: Pink (#f357bb)
 * - TMCG: Pink (#f357bb)
 * - Default: Primary text color (#fafafa)
 */

export function OdsCurrentTest() {
  return (
    <div className="min-h-screen space-y-8 bg-ods-bg p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="mb-4 text-3xl font-bold text-ods-text-primary">ODS Current Color Token Test</h1>

        <p className="mb-8 text-ods-text-secondary">
          The boxes below should show platform-specific colors using the{' '}
          <code className="rounded bg-ods-card px-2 py-1">ods-current</code> token.
        </p>

        {/* Text Color Test */}
        <div className="rounded-lg border border-ods-border bg-ods-card p-6">
          <h2 className="mb-4 text-xl font-semibold text-ods-text-primary">Text Color Test</h2>
          <p className="text-2xl font-bold text-ods-current">This text uses text-ods-current</p>
          <p className="mt-2 text-sm text-ods-text-secondary">
            Expected: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* Background Color Test */}
        <div className="rounded-lg border border-ods-border bg-ods-card p-6">
          <h2 className="mb-4 text-xl font-semibold text-ods-text-primary">Background Color Test</h2>
          <div className="rounded bg-ods-current p-4">
            <p className="font-semibold text-black">This box uses bg-ods-current</p>
          </div>
          <p className="mt-2 text-sm text-ods-text-secondary">
            Expected background: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* Border Color Test */}
        <div className="rounded-lg border border-ods-border bg-ods-card p-6">
          <h2 className="mb-4 text-xl font-semibold text-ods-text-primary">Border Color Test</h2>
          <div className="rounded border-4 border-ods-current p-4">
            <p className="text-ods-text-primary">This box uses border-ods-current</p>
          </div>
          <p className="mt-2 text-sm text-ods-text-secondary">
            Expected border: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* SVG Fill Test */}
        <div className="rounded-lg border border-ods-border bg-ods-card p-6">
          <h2 className="mb-4 text-xl font-semibold text-ods-text-primary">SVG Fill Test</h2>
          <svg width="100" height="100" viewBox="0 0 100 100" className="fill-ods-current">
            <circle cx="50" cy="50" r="40" />
          </svg>
          <p className="mt-2 text-sm text-ods-text-secondary">
            Expected fill: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* CSS Variable Test */}
        <div className="rounded-lg border border-ods-border bg-ods-card p-6">
          <h2 className="mb-4 text-xl font-semibold text-ods-text-primary">CSS Variable Direct Usage</h2>
          <div
            style={{
              color: 'var(--ods-current)',
              fontSize: '24px',
              fontWeight: 'bold',
            }}
          >
            This text uses CSS variable directly
          </div>
          <p className="mt-2 text-sm text-ods-text-secondary">
            Expected: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* Current Platform Info */}
        <div className="rounded-lg border border-ods-border bg-ods-card p-6">
          <h2 className="mb-4 text-xl font-semibold text-ods-text-primary">Current Platform Context</h2>
          <p className="text-ods-text-secondary">
            Check the <code className="rounded bg-ods-bg px-2 py-1">data-app-type</code> attribute on the root element
            to see which platform theme is active.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-ods-text-secondary">OpenFrame:</span>
              <span className="text-[#ffc008]">Yellow (#ffc008)</span>
            </div>
            <div className="flex gap-2">
              <span className="text-ods-text-secondary">Flamingo:</span>
              <span className="text-[#f357bb]">Pink (#f357bb)</span>
            </div>
            <div className="flex gap-2">
              <span className="text-ods-text-secondary">TMCG:</span>
              <span className="text-[#f357bb]">Pink (#f357bb)</span>
            </div>
            <div className="flex gap-2">
              <span className="text-ods-text-secondary">Default:</span>
              <span className="text-ods-text-primary">White (#fafafa)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
