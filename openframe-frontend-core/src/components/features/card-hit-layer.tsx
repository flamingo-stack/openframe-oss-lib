"use client";

/**
 * <CardHitLayer> — THE full-bleed click target for media cards.
 *
 * A CONTENTLESS `<a>`/`<button>` stretched over its positioned parent. Cards
 * that show a video with overlaid chrome (walkthrough mini player, video-bite
 * cards) all need the same thing: the whole card is one click target, while the
 * visible label/controls sit above it as their own positioned elements.
 *
 * Why contentless: putting the label INSIDE the interactive element makes the
 * element content-sized, so it collapses around the label instead of covering
 * the card — that produced both a mis-placed title and a mostly-unclickable
 * card in the walkthrough widget. Separating "what you click" from "what you
 * see" makes both deterministic.
 *
 * Why a component and not a copied className: the two consumers drifted (only
 * one had `cursor-pointer`, only one covered the full card), which is exactly
 * the class of inconsistency this exists to prevent.
 *
 * The host owns stacking + hover gating via `className` (e.g. `z-20`, or the
 * bite strip's `pointer-events-none group-hover/card:pointer-events-auto`).
 */

import React from 'react';
import { cn } from '../../utils/cn';

export interface CardHitLayerProps {
  /** Accessible name. The layer has no content, so this IS its label. */
  label: string;
  /** Renders an anchor when set, otherwise a button. */
  href?: string | null;
  onClick?: (e: React.MouseEvent) => void;
  /** Runs before click — used to stop media synchronously (audio-blip guard). */
  onPointerDown?: (e: React.PointerEvent) => void;
  /** Stacking + pointer-event gating supplied by the host. */
  className?: string;
}

/** Reset every UA affordance so the layer is invisible but clickable. The
 *  pointer cursor comes from the ODS base rule (ods-interaction-states.css),
 *  not from here — one definition for every control in the system. */
const HIT_LAYER_BASE =
  'absolute inset-0 block h-full w-full appearance-none border-0 bg-transparent p-0 ' +
  // A transparent full-card button is otherwise invisible to keyboard users.
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus';

export function CardHitLayer({
  label,
  href,
  onClick,
  onPointerDown,
  className,
}: CardHitLayerProps): React.ReactElement {
  if (href) {
    return (
      <a
        href={href}
        aria-label={label}
        onClick={onClick}
        onPointerDown={onPointerDown}
        className={cn(HIT_LAYER_BASE, className)}
      />
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(HIT_LAYER_BASE, className)}
    />
  );
}
