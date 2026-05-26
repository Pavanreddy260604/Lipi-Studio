export type MasterScriptSourceFormat =
    | 'pdf'
    | 'docx'
    | 'txt'
    | 'md'
    | 'fountain'
    | 'script'
    | 'raw_text';

export type MasterScriptSourceKind = 'title_page' | 'body' | 'page_marker';

export interface MasterScriptSourceLayoutLine {
    lineNo: number;
    pageNo: number;
    pageLineNo: number;
    rawText: string;
    isBlank: boolean;
    indentColumns: number;
    lineHash: string;
    lineId: string;
    sourceKind: MasterScriptSourceKind;
    xStart?: number;
    yTop?: number;
}

export interface ExtractedMasterScriptSource {
    sourceFormat: MasterScriptSourceFormat;
    layoutVersion: string;
    rawContent: string;
    pageCount: number;
    warnings: string[];
    lines: MasterScriptSourceLayoutLine[];
}
