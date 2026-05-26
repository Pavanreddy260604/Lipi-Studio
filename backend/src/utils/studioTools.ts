
export const STUDIO_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'generate_treatment',
            description: 'Generate a high-level story outline, beat sheet, or treatment for the project.',
            parameters: {
                type: 'object',
                properties: {
                    instruction: { type: 'string', description: 'Specific user instruction for the treatment' },
                    style: { type: 'string', description: 'Story structure style (e.g., Save The Cat, 3-Act)' },
                    sceneCount: { type: 'number', description: 'Target number of scenes' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'edit_scene',
            description: 'Rewrite, fix, or improve the current scene or a selection.',
            parameters: {
                type: 'object',
                properties: {
                    instruction: { type: 'string', description: 'What to change in the scene' },
                    scope: { type: 'string', enum: ['scene', 'selection'], description: 'Whether to edit the whole scene or just the selected text' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'analyze_story',
            description: 'Perform analytical tasks like character arc analysis, subtext checks, or pacing reviews.',
            parameters: {
                type: 'object',
                properties: {
                    task: { type: 'string', enum: ['character_arcs', 'subtext', 'pacing'], description: 'The type of analysis to perform' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'export_script',
            description: 'Export the script to a specific file format.',
            parameters: {
                type: 'object',
                properties: {
                    format: { type: 'string', enum: ['pdf', 'fountain'], description: 'The target export format' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'query_lore_and_relationships',
            description: 'Query the relational lore graph to retrieve characters, locations, factions, and their connections from the database.',
            parameters: {
                type: 'object',
                properties: {
                    entityName: { type: 'string', description: 'Name of the character, location, object, or faction to query (e.g., KARNA, SURYA).' },
                    relationshipType: { type: 'string', enum: ['sibling_of', 'hates', 'allied_with', 'parent_of', 'owns', 'member_of', 'other', 'any'], description: 'Filter relationships by type' }
                },
                required: ['entityName']
            }
        }
    }
];
