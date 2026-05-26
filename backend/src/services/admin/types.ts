import type { IMasterScript } from '../../models/MasterScript';
import type { ExtractedMasterScriptSource, MasterScriptSourceFormat, MasterScriptSourceLayoutLine } from '../../types/masterScriptLayout';

type GateStatus = 'pending' | 'passed' | 'failed';

interface StartMasterScriptProcessingResult {
    scriptVersion: string;
    gateStatus: GateStatus;
}

interface CreateMasterScriptInput extends Partial<IMasterScript> {
    extractedSource?: ExtractedMasterScriptSource;
}

export type { GateStatus, StartMasterScriptProcessingResult, CreateMasterScriptInput, ExtractedMasterScriptSource, MasterScriptSourceFormat, MasterScriptSourceLayoutLine };
