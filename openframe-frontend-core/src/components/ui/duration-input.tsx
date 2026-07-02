"use client";

import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "../../utils/cn";

export interface DurationInputProps {
  /** Duration as `HH:MM:SS`. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  className?: string;
}

type Segments = [string, string, string];

const SEGMENT_META = [
  { label: "Hours", placeholder: "HH", max: 99 },
  { label: "Minutes", placeholder: "MM", max: 59 },
  { label: "Seconds", placeholder: "SS", max: 59 },
] as const;

const pad2 = (s: string): string => s.padStart(2, "0").slice(-2);
const compose = (s: Segments): string => `${pad2(s[0])}:${pad2(s[1])}:${pad2(s[2])}`;
const split = (value: string): Segments => {
  const parts = value.split(":");
  return [parts[0] || "00", parts[1] || "00", parts[2] || "00"];
};

/**
 * Segmented `HH:MM:SS` entry: each unit is its own field, typing fills the focused
 * segment and auto-advances, arrows move/increment. Segments clamp to their max
 * (MM/SS ≤ 59), so an invalid duration can't be produced. Value in/out is `HH:MM:SS`.
 */
export function DurationInput({ value, onChange, invalid, className }: DurationInputProps) {
  const [segments, setSegments] = useState<Segments>(() => split(value));
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Adopt an externally-set value (edit pre-fill / form reset) without clobbering in-progress typing.
  useEffect(() => {
    setSegments((prev) => (compose(prev) === value ? prev : split(value)));
  }, [value]);

  const focusSegment = (i: number) => {
    const el = refs[i]?.current;
    if (!el) return;
    el.focus();
    el.select();
  };

  const commit = (next: Segments, advanceFrom?: number) => {
    setSegments(next);
    onChange(compose(next));
    if (advanceFrom !== undefined && advanceFrom < 2) focusSegment(advanceFrom + 1);
  };

  const handleChange = (i: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "").slice(-2);
    const { max } = SEGMENT_META[i];
    const next = [...segments] as Segments;

    if (digits.length === 2) {
      next[i] = String(Math.min(Number(digits), max));
      commit(next, i);
    } else if (digits.length === 1 && max === 59 && Number(digits) > 5) {
      // 6–9 can't start a valid two-digit minute/second, so commit and advance now.
      next[i] = digits;
      commit(next, i);
    } else {
      next[i] = digits;
      commit(next);
    }
  };

  const handleKeyDown = (i: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    const el = event.currentTarget;
    const { max } = SEGMENT_META[i];

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? 1 : -1;
      const nextValue = (Number(segments[i] || "0") + delta + (max + 1)) % (max + 1);
      const next = [...segments] as Segments;
      next[i] = String(nextValue);
      commit(next);
      requestAnimationFrame(() => el.select());
    } else if (event.key === "ArrowLeft" && el.selectionStart === 0 && i > 0) {
      event.preventDefault();
      focusSegment(i - 1);
    } else if (event.key === "ArrowRight" && el.selectionEnd === el.value.length && i < 2) {
      event.preventDefault();
      focusSegment(i + 1);
    } else if (event.key === "Backspace" && el.value === "" && i > 0) {
      event.preventDefault();
      focusSegment(i - 1);
    } else if (event.key === ":" && i < 2) {
      event.preventDefault();
      focusSegment(i + 1);
    }
  };

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          focusSegment(0);
        }
      }}
      className={cn(
        "flex h-11 w-full items-center gap-[var(--spacing-system-xxs)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-sf)] transition-colors duration-200 md:h-12",
        "cursor-text focus-within:border-ods-accent",
        invalid && "border-ods-error focus-within:border-ods-error",
        className,
      )}
    >
      {SEGMENT_META.map((meta, i) => (
        <Fragment key={meta.label}>
          {i > 0 && <span className="text-ods-text-secondary">:</span>}
          <input
            ref={refs[i]}
            inputMode="numeric"
            size={2}
            value={segments[i]}
            onChange={handleChange(i)}
            onKeyDown={handleKeyDown(i)}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={() =>
              setSegments((prev) => {
                const padded = [...prev] as Segments;
                padded[i] = pad2(prev[i]);
                return padded;
              })
            }
            placeholder={meta.placeholder}
            aria-label={meta.label}
            className="rounded-sm bg-transparent text-center !font-mono text-h4 tabular-nums text-ods-text-primary outline-none placeholder:text-ods-text-secondary focus:bg-ods-bg-hover"
          />
        </Fragment>
      ))}
    </div>
  );
}
