import type { EnvelopeKind } from "./types";

export const DEFERRED_BODY_ENVELOPES_VALUES = [
    'set',
    'map',
    'error'
] as const;

export const DEFERRED_BODY_ENVELOPES = new Set<EnvelopeKind>(DEFERRED_BODY_ENVELOPES_VALUES);
