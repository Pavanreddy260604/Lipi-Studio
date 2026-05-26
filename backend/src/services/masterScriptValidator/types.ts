import { IMasterScriptValidationReport } from '../../models/MasterScriptValidationReport';

export interface ValidationRunResult {
    passed: boolean;
    report: IMasterScriptValidationReport;
}
