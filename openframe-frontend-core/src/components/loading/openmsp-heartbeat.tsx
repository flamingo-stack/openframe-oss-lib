'use client';

import { OpenmspLogo } from '../openmsp-logo';

export function OpenmspHeartbeatLoader({
  className = '',
  progress = 0,
  label,
  barWidth = 'w-128',
}: {
  className?: string;
  progress?: number;
  label?: string;
  barWidth?: string;
}) {
  return (
    <div
      className={'max-w-screen flex max-h-screen min-h-screen items-center justify-center ' + className}
      role="status"
      aria-label="Generating report"
    >
      <div className="justify-top flex flex-col items-center">
        <div className="inline-flex origin-center animate-pulse">
          <OpenmspLogo
            className="mb-10 h-16 w-16 text-ods-accent opacity-90 md:h-24 md:w-24"
            frontBubbleColor="#f1f1f1"
            innerFrontBubbleColor="#000000"
            backBubbleColor="#FFC008"
          />
        </div>

        <div className={`${barWidth} flex flex-col items-center justify-center`}>
          {/* Progress text */}
          <h2 className="mt-2 text-center font-bold text-ods-accent">
            {progress > 0 ? Math.floor(progress) : 0}% <span className="text-ods-text-secondary text-h6">/100%</span>
          </h2>

          {/* Progress text */}
          <h3 className="mt-2 text-center text-ods-text-primary">{label ?? `Processing…`}</h3>
          <p className="mt-2 text-center text-ods-text-secondary">
            You can safely navigate away from this page, report generation will continue in the background.
          </p>
        </div>
      </div>
    </div>
  );
}
