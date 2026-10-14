import React from 'react';
import { Clock, FileText, FolderGit2, Scale, User, Users } from 'lucide-react';
import { GraphNode } from '../types';

/* ==========================================================================
   Shared explorer dimensions
   --------------------------------------------------------------------------
   The six real OrgMind entity categories behave as the six navigable
   dimensions of the cube explorer. This module holds everything the cube and
   the Scratch connection map have to agree on:

     • the dimension order (and the 1–6 keyboard shortcuts)
     • the Nothing OS luminance ramp used by the monochrome cube
     • the Scratch block palette — the only place category colour is allowed
   ========================================================================== */

export const CUBE_DIMENSIONS = [
  'Project',
  'Task',
  'Person',
  'Team',
  'Decision',
  'Document',
] as const;

export type CubeDimension = (typeof CUBE_DIMENSIONS)[number];

export const DIMENSION_ICONS: Record<CubeDimension, React.FC<{ size: number }>> = {
  Project: FolderGit2,
  Task: Clock,
  Person: User,
  Team: Users,
  Decision: Scale,
  Document: FileText,
};

/** Nothing OS luminance ramp — the cube stays monochrome by design. */
export const DIMENSION_RAMP: Record<CubeDimension, string> = {
  Project: 'var(--cat-project)',
  Task: 'var(--cat-task)',
  Person: 'var(--cat-person)',
  Team: 'var(--cat-team)',
  Decision: 'var(--cat-decision)',
  Document: 'var(--cat-document)',
};

/** Scratch palette (variables / motion / looks / my-blocks / events / operators) */
export const SCRATCH_BLOCK_COLORS: Record<CubeDimension, { bg: string; text: string }> = {
  Project: { bg: '#FF8C1A', text: '#1B1300' },
  Task: { bg: '#4C97FF', text: '#FFFFFF' },
  Person: { bg: '#9966FF', text: '#FFFFFF' },
  Team: { bg: '#FF6680', text: '#FFFFFF' },
  Decision: { bg: '#FFBF00', text: '#2A1E00' },
  Document: { bg: '#59C059', text: '#FFFFFF' },
};

export const BLOCKING_RELATIONS = new Set(['BLOCKED_BY', 'WAITING_FOR']);

export function dimensionOf(node: GraphNode): CubeDimension {
  return (CUBE_DIMENSIONS as readonly string[]).includes(node.label)
    ? (node.label as CubeDimension)
    : 'Document';
}

export function nodeTitle(node: GraphNode | undefined, fallback: string) {
  if (!node) return fallback;
  return node.properties?.name || node.properties?.title || node.id;
}

/* ---------------------------------------------------------- panel sizing */

export const PANEL_MIN_WIDTH = 300;
export const PANEL_MAX_WIDTH = 720;

export function clampPanelWidth(width: number) {
  const viewportMax =
    typeof window === 'undefined'
      ? PANEL_MAX_WIDTH
      : Math.min(PANEL_MAX_WIDTH, window.innerWidth * 0.62);
  const safe = Number.isFinite(width) ? width : PANEL_MIN_WIDTH;
  return Math.round(
    Math.min(Math.max(safe, PANEL_MIN_WIDTH), Math.max(PANEL_MIN_WIDTH, viewportMax))
  );
}

/* ------------------------------------------------------- focus requests */

export interface FocusRequest {
  nodeId: string;
  nonce: number;
}

let focusNonce = 0;

/** One monotonic counter for every focus hand-off, so "newest wins" is exact. */
export function nextFocusNonce() {
  focusNonce += 1;
  return focusNonce;
}

export function latestFocus(
  a: FocusRequest | null | undefined,
  b: FocusRequest | null | undefined
): FocusRequest | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.nonce >= b.nonce ? a : b;
}
