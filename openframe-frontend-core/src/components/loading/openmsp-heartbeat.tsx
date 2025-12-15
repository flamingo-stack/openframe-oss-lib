"use client";

import React from 'react';
import { OpenmspLogo } from '../openmsp-logo';

export function OpenmspHeartbeatLoader({ className = '', progress = 0, label, barWidth = 'w-128' }: { className?: string; progress?: number; label?: string; barWidth?: string }) {
  return (
    <div className={"flex items-center justify-center max-w-screen max-h-screen min-h-screen " + className} role="status" aria-label="Generating report">
      {/* Inline keyframes to bypass Tailwind build issues */}
      <style>{`
        /* Lub-dub double-beat: quick pulse, quick pulse, rest */
        @keyframes heartbeatInline {
          0%   { transform: scale(1);      opacity: 0.96; }
          8%   { transform: scale(1.07);   opacity: 1;    }
          16%  { transform: scale(1);      opacity: 0.98; }
          24%  { transform: scale(1.07);   opacity: 1;    }
          32%  { transform: scale(1);      opacity: 0.96; }
          /* small rebound */
          40%  { transform: scale(0.97);   opacity: 0.94; }
          /* rest */
          70%  { transform: scale(1);      opacity: 0.96; }
          100% { transform: scale(1);      opacity: 0.96; }
        }
      `}</style>
      <div className="flex flex-col items-center justify-top">
        <div style={{ animation: 'heartbeatInline 3.6s ease-in-out infinite', transformOrigin: 'center center', display: 'inline-flex' }}>
          <OpenmspLogo
            className="w-16 h-16 md:w-24 md:h-24 mb-10 text-ods-accent opacity-90"
            frontBubbleColor="#f1f1f1"
            innerFrontBubbleColor="#000000"
            backBubbleColor="#FFC008"
          />
        </div>

        <div className="flex flex-col items-center justify-center w-128">
          {/* Progress text */} 
          <h2 className="mt-2 text-ods-accent text-center font-bold">
            {progress != undefined && progress > 0 ? Math.floor(progress) : 0}% <span  className="text-sm text-ods-text-secondary">/100%</span>
          </h2>

          {/* Progress text */}
          <h3 className="mt-2 text-ods-text-primary text-center">
            {label ?? `Processing…`}
          </h3>
          <p className="mt-2 text-ods-text-secondary text-center">
            You can safely navigate away from this page, report generation will continue in the background.
          </p>
        </div>
      </div>
    </div>
  );
} 