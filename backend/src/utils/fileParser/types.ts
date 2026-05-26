import type {
    ExtractedMasterScriptSource,
    MasterScriptSourceFormat,
    MasterScriptSourceKind,
    MasterScriptSourceLayoutLine
} from '../../types/masterScriptLayout';

export interface PendingSourceLine {
    pageNo: number;
    rawText: string;
    xStart?: number;
    yTop?: number;
}

export interface PdfWord {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export const LAYOUT_VERSION = 'ms-layout-v1';
export const X_TO_COLUMN_RATIO = 7.4;
export const PAGE_MARKER_PATTERN = /^(?:Page\s+)?-?\s*(?:\d+|[IVXLC]+(?:-\d+)?)\.?\s*-?$/i;
export const SCENE_HEADING_PATTERN = /^(?:INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|EST\.?|INT\.?|EXT\.?)\s+.+$/i;
export const NUMBERED_SCENE_HEADING_PATTERN = /^(?:(?:#[A-Za-z0-9.-]+#)|(?:\d+[A-Za-z0-9.-]*))\s+(?:INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|EST\.?|INT\.?|EXT\.?)\s+.+$/i;
export const TRANSITION_PATTERN = /^(?:FADE IN:?|FADE OUT\.?|CUT TO:|DISSOLVE TO:|MATCH CUT TO:|SMASH CUT TO:|FADE TO BLACK\.?)$/i;
export const CREDIT_PATTERN = /^(?:written by|screenplay by|story by|directed by|adapted by|based on|teleplay by|by|shooting script|first draft|revised draft|contact)\b/i;
export const NOTE_PATTERN = /^(\[\[|\/\*|#{1,6}\s+|=\s*|>\s*.+\s*<)/;
