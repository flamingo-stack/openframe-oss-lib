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

import React from 'react'

export function OdsCurrentTest() {
  return (
    <div className="p-8 space-y-8 bg-ods-bg min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-ods-text-primary mb-4">
          ODS Current Color Token Test
        </h1>

        <p className="text-ods-text-secondary mb-8">
          The boxes below should show platform-specific colors using the <code className="bg-ods-card px-2 py-1 rounded">ods-current</code> token.
        </p>

        {/* Text Color Test */}
        <div className="bg-ods-card p-6 rounded-lg border border-ods-border">
          <h2 className="text-xl font-semibold text-ods-text-primary mb-4">
            Text Color Test
          </h2>
          <p className="text-ods-current text-2xl font-bold">
            This text uses text-ods-current
          </p>
          <p className="text-sm text-ods-text-secondary mt-2">
            Expected: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* Background Color Test */}
        <div className="bg-ods-card p-6 rounded-lg border border-ods-border">
          <h2 className="text-xl font-semibold text-ods-text-primary mb-4">
            Background Color Test
          </h2>
          <div className="bg-ods-current p-4 rounded">
            <p className="text-black font-semibold">
              This box uses bg-ods-current
            </p>
          </div>
          <p className="text-sm text-ods-text-secondary mt-2">
            Expected background: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* Border Color Test */}
        <div className="bg-ods-card p-6 rounded-lg border border-ods-border">
          <h2 className="text-xl font-semibold text-ods-text-primary mb-4">
            Border Color Test
          </h2>
          <div className="border-4 border-ods-current p-4 rounded">
            <p className="text-ods-text-primary">
              This box uses border-ods-current
            </p>
          </div>
          <p className="text-sm text-ods-text-secondary mt-2">
            Expected border: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* SVG Fill Test */}
        <div className="bg-ods-card p-6 rounded-lg border border-ods-border">
          <h2 className="text-xl font-semibold text-ods-text-primary mb-4">
            SVG Fill Test
          </h2>
          <svg width="100" height="100" viewBox="0 0 100 100" className="fill-ods-current">
            <circle cx="50" cy="50" r="40" />
          </svg>
          <p className="text-sm text-ods-text-secondary mt-2">
            Expected fill: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* CSS Variable Test */}
        <div className="bg-ods-card p-6 rounded-lg border border-ods-border">
          <h2 className="text-xl font-semibold text-ods-text-primary mb-4">
            CSS Variable Direct Usage
          </h2>
          <div
            style={{
              color: 'var(--ods-current)',
              fontSize: '24px',
              fontWeight: 'bold'
            }}
          >
            This text uses CSS variable directly
          </div>
          <p className="text-sm text-ods-text-secondary mt-2">
            Expected: Yellow (OpenFrame), Pink (Flamingo/TMCG), White (Default)
          </p>
        </div>

        {/* Current Platform Info */}
        <div className="bg-ods-card p-6 rounded-lg border border-ods-border">
          <h2 className="text-xl font-semibold text-ods-text-primary mb-4">
            Current Platform Context
          </h2>
          <p className="text-ods-text-secondary">
            Check the <code className="bg-ods-bg px-2 py-1 rounded">data-app-type</code> attribute
            on the root element to see which platform theme is active.
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
  )
}
