import { ICharacter } from '../../models/Character';
import { loreSyncService } from '../loreSync.service';

export async function enrichExistingCharacter(
    existingChar: ICharacter,
    charData: any
): Promise<'none' | 'updated'> {
    let modified = false;

    if (Array.isArray(charData.traits)) {
        const currentTraits = existingChar.traits || [];
        const newTraits = charData.traits.filter((t: string) => t && !currentTraits.some(ct => ct.toUpperCase() === t.toUpperCase()));
        if (newTraits.length > 0) {
            existingChar.traits = [...currentTraits, ...newTraits];
            modified = true;
        }
    }

    if (charData.motivation && charData.motivation.trim().length > (existingChar.motivation || '').trim().length) {
        existingChar.motivation = charData.motivation.trim();
        modified = true;
    }

    if (charData.currentStatus && charData.currentStatus !== 'Stable' && charData.currentStatus !== existingChar.currentStatus) {
        existingChar.currentStatus = charData.currentStatus;
        modified = true;
    }

    if (Array.isArray(charData.heldItems) && charData.heldItems.length > 0) {
        const currentItems = existingChar.heldItems || [];
        const newItems = charData.heldItems.filter((i: string) => i && !currentItems.some(ci => ci.toUpperCase() === i.toUpperCase()));
        if (newItems.length > 0) {
            existingChar.heldItems = [...currentItems, ...newItems];
            modified = true;
        }
    }

    if (charData.voiceDescription && !existingChar.voice?.description) {
        existingChar.voice = {
            ...existingChar.voice,
            description: charData.voiceDescription
        } as any;
        modified = true;
    }

    if (charData.accent && !existingChar.voice?.accent) {
        existingChar.voice = {
            ...existingChar.voice,
            accent: charData.accent
        } as any;
        modified = true;
    }

    if (charData.sampleDialogue) {
        const currentLines = existingChar.voice?.sampleLines || [];
        if (!currentLines.includes(charData.sampleDialogue) && currentLines.length < 5) {
            existingChar.voice = {
                ...existingChar.voice,
                sampleLines: [...currentLines, charData.sampleDialogue]
            } as any;
            modified = true;
        }
    }

    if (Array.isArray(charData.relationships) && charData.relationships.length > 0) {
        const currentRels = existingChar.relationships || [];
        let relsModified = false;

        for (const newRel of charData.relationships) {
            if (!newRel.targetCharName || !newRel.dynamic) continue;

            const matchIdx = currentRels.findIndex(r => r.targetCharName.toUpperCase() === newRel.targetCharName.toUpperCase());
            if (matchIdx >= 0) {
                if (currentRels[matchIdx].dynamic !== newRel.dynamic) {
                    currentRels[matchIdx].dynamic = newRel.dynamic;
                    relsModified = true;
                }
            } else {
                currentRels.push(newRel);
                relsModified = true;
            }
        }

        if (relsModified) {
            existingChar.relationships = currentRels;
            modified = true;
        }
    }

    if (modified) {
        await existingChar.save();
        await loreSyncService.syncCharacter(existingChar);
        return 'updated';
    }

    return 'none';
}
