"use client";

/**
 * SimpleMarkdownRenderer — the chat/doc composition over the unified
 * `MarkdownEngine`. This IS the real component (not a compat alias): the
 * old 966-line standalone implementation was deleted in the unification;
 * its entire prop surface maps 1:1 onto the engine. Chat consumers keep
 * layering `additionalRemarkPlugins` (card/mention links) and
 * `componentOverrides` exactly as before.
 */
import React, { memo } from 'react';
import { MarkdownEngine, type MarkdownEngineProps } from './engine';
import type { ResolveLinkResult } from '../../../types/doc-source';

export type { ResolveLinkResult };

export interface SimpleMarkdownRendererProps
  extends Omit<MarkdownEngineProps, 'extraAllowedHtmlTags'> {}

const SimpleMarkdownRendererImpl: React.FC<SimpleMarkdownRendererProps> = (props) => (
  <MarkdownEngine {...props} />
);

/** Memoized — see the engine's memo rationale (streaming card remounts). */
export const SimpleMarkdownRenderer = memo(SimpleMarkdownRendererImpl);
