"use client";

/**
 * SimpleMarkdownRenderer — the chat/doc composition over the unified
 * `MarkdownEngine`. This IS the real component (not a compat alias): the
 * old 966-line standalone implementation was deleted in the unification;
 * its entire prop surface maps 1:1 onto the engine. Chat consumers keep
 * layering `additionalRemarkPlugins` (card/mention links) and
 * `componentOverrides` exactly as before.
 */
import React from 'react';
import { MarkdownEngine, type MarkdownEngineProps } from './engine';
import type { ResolveLinkResult } from '../../../types/doc-source';

export type { ResolveLinkResult };

export interface SimpleMarkdownRendererProps
  extends Omit<MarkdownEngineProps, 'extraAllowedHtmlTags'> {}

/**
 * A type-narrowed ALIAS of the engine, not a wrapper: the composition adds
 * no behavior (it only hides `extraAllowedHtmlTags` from the prop surface),
 * and `MarkdownEngine` is already `memo`'d. Wrapping it in a second `memo`
 * bought nothing and cost an extra shallow-compare pass plus a fiber per
 * chat segment.
 */
export const SimpleMarkdownRenderer =
  MarkdownEngine as React.NamedExoticComponent<SimpleMarkdownRendererProps>;
