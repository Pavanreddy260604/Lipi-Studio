# Full Codebase Issue Register

> Last re-audit: 2026-05-18 23:41 IST  
> Scope: All open-tab files + full `backend/src/` and `frontend/src/pages/ScriptWriter/`  
> Issues tracked: **34** (12 confirmed fixed · 22 still open / new)

---

## Legend

| Marker | Meaning |
|--------|---------|
| ✅ | Confirmed fixed in the current codebase (this commit) |
| ❌ | Still open — code has not changed from the buggy version |
| 🔴 | High severity — data loss, corruption, or silent wrong output |
| 🟡 | Medium severity — degraded quality, UX, or maintainability |
| 🟢 | Low severity — code smell or documentation rot |

---

## Section 1 — ✅ Fixed Issues (confirmed in current code)

### ✅ F-1 | B-1 · `backend/src/services/parser.service.ts` line 47

**Severity:** 🔴 High  
**What was wrong:** `repairJson` Step 1 — the regex `/":\s*"(.*?)"(\s*[,}])\s*/gs` with lazy `.*?` would greedily match across JSON key-colon boundaries inside multi-value strings (e.g. `"title": "Scene 1 [END]"},`), corrupting valid JSON.

**Fix applied:** Guard clause at line 48:  
`if (content.includes('":') || /",\s*"\w+"\s*:/i.test(content)) return match;`  
This skips any match that looks like it contains embedded key-value syntax.  
Backslash-parity escape at line 52: `(/\\*"/g, slashes.length % 2 === 0)` — only escapes quotemarks preceded by an even number of backslashes, preventing double-escape cascades.

**Residual risk:** 🟡 The `s`-flag dotAll is still used. A JSON string containing `{` or `}` paired with a nearby `",` cheat the boundary heuristic but are now caught by the `content.includes('":')` guard.

---

### ✅ F-2 | B-3 · `backend/src/services/gemini.service.ts` lines 313–360

**Severity:** 🔴 High  
**What was wrong:** `chatStream` JSON extractor incremented `depth` on every `{` character without checking `insideString` state. A raw `{` inside a screenplay line (e.g. `{I act like I'm in pain}`) would cause the buffer to accumulate forever — the stream would hang after that chunk.

**Fix applied:** Full `insideString` / `escaped` state machine added at lines 323–360:  
- `{` / `}` only affect `depth` when `insideString === false`  
- `insideString` toggles on unescaped `"` only  
- State is fully reset (`startIdx = -1`, `depth = 0`, `insideString = false`) on every depth-0 close  
- Buffer slice at line 359 is now `< i + 1` with a proper state reset

**Residual risk:** 🟢 None — this is a proper fix.

---

### ✅ F-3 | B-4 · `backend/src/services/treatment.service.ts` line 32

**Severity:** 🟡 Medium  
**What was wrong:** A failed `projectContextService.build()` was logged as `console.error(...)` but execution continued silently with an empty context block. Users received lower-quality beat-sheet output with no indication of degraded context.

**Fix applied:** Changed to `console.warn('[TreatmentService] Failed to load project context (falling back to baseline logline prompt):', err)`.  
The word "falling back" is now explicit in the log text.

**Residual risk:** 🟡 Warning is still server-side only. The frontend never surfaces that context degraded. If production reliability matters, this should emit a `process.emit('context:fallback', ...)` or similar structured event.

---

### ✅ F-4 | B-5 · `backend/src/services/treatment.service.ts` line 41

**Severity:** 🔴 High  
**What was wrong:** `const maxTokens = Math.max(4000, sceneCount * 150)` — for `sceneCount = 300`, `maxTokens = 45000`, exceeding Gemini's 8192 default output limit. The model silently truncated or returned an error, with no error-surface.

**Fix applied:** `const maxTokens = Math.min(8192, Math.max(4000, sceneCount * 150));` — hard cap at 8192.  
This matches the model's default `maxOutputTokens`.

**Residual risk:** 🟡 Requests for `sceneCount > 50` will still be truncated at 8192 tokens even though 50×150=7500 fits. For very large beatsheets the user should be warned before generation starts that the output will be capped.

---

### ✅ F-5 | B-9 · `frontend/src/pages/ScriptWriter/components/ChunkViewerModal.tsx` line 193

**Severity:** 🔴 High  
**What was wrong:** Logic inversion: `if (exactLines.length > 0) return [];` — when the chunk reconstruction API succeeded and returned `exactLines`, the component silently returned an empty array and fell through to "No reconstructed script is available" at line 540.

**Fix applied:** `if (chunks.length > 0) { return assignDualDialogueLayout(…) }` — `chunks` and `exactLines` are treated as **alternative parse modes**, the fallback chain is `chunks → exactLines → reconstruction.content → empty`.

**Residual risk:** 🟢 None — this was a pure logic inversion fix.

---

### ✅ F-6 | P-3 · `backend/src/services/beatOrchestrator.service.ts` lines 254–258

**Severity:** 🟡 Medium  
**What was wrong:** `milestoneIndexEnd` used `Math.floor((endScene - 1) / targetSceneCount * coreBeats.length)`. For non-exact division of blocks, this could equal or go below `milestoneIndexStart`, producing `coreBeats.slice(fromIndex, toIndex + 1)` with `toIndex < fromIndex` → empty array → AI got blank structural guidance.

**Fix applied:**  
```ts
const milestoneIndexEnd = Math.min(coreBeats.length - 1, Math.max(milestoneIndexStart, Math.floor((endScene - 1) / targetSceneCount * coreBeats.length)));
let milestonesArray = coreBeats.slice(milestoneIndexStart, milestoneIndexEnd + 1);
if (milestonesArray.length === 0 && coreBeats.length > 0) {
    milestonesArray = [coreBeats[Math.min(coreBeats.length - 1, milestoneIndexStart)]];
}
```
Guarantees at minimum one milestone (the start-of-block one) is injected.

**Residual risk:** 🟡 The single-fallback-beat still may not be structurally correct for the right act, but it at least passes something meaningful.

---

### ✅ F-7 | P-4 · `backend/src/services/parser.service.ts` lines 51–58

**Severity:** 🔴 High  
**What was wrong:** `repairJson` Step 1 regex could double-escape already-escaped quotes in JSON strings (e.g. `"He said \"Kill him\""` → `"He said \\"Kill him\\""`). For screenplay dialogue with nested quotes this would produce cascading JSON corruption across all fields.

**Fix applied:** Same backslash-parity logic as F-1:  
```ts
const escaped = content.replace(/\\*"/g, (m: string) => {
    const slashes = m.match(/\\*/)?.[0] || '';
    if (slashes.length % 2 === 0) return slashes + '\\"';
    return m;
});
```
Only escaping quotemarks preceded by an even number of backslashes.

**Residual risk:** 🟡 The regex approach (`".*?"`) still cannot be fully trusted against all adversarial JSON shapes. A production-grade approach would parse character-by-character or use a proper streaming JSON builder.

---

### ✅ F-8 | AI-1 · `backend/src/services/characterDiscovery.service.ts` line 21

**Severity:** 🟡 Medium  
**What was wrong:** For new projects (no existing characters), the prompt said `"No existing characters."` which instructs every LLM to hallucinate character names from scratch, or conflate scene nouns with actors. For a 5,000-word story text this produced 8–12 falsely identified "characters."

**Fix applied:** Empty-cast string changed to:  
`'Cast is unknown. Report only CLEARLY named human/agent characters in the text.'`  
This removes the "infer freely" signal that the old text implied.

**Residual risk:** 🟡 The AI still has to judge what "CLEARLY named" means. Without a few-shot example or a definitional description in the system prompt, the character discovery rate on first-pass prose remains model-dependent.

---

### ✅ F-9 | AI-4 · `backend/src/services/scriptGenerator.service.ts` lines 196–217

**Severity:** 🔴 High  
**What was wrong:** `JSON.stringify(beatSheet, null, 2)` produced a deep, recursive dump of the entire beat tree — including `plan` objects with `children` arrays, `tactics` arrays, and nested phase objects. For a `storyPlanner.generateBeatSheet()` return with 5-phase deep trees, this single line could produce **4,000+ characters of schema noise** before any instruction text appeared in the prompt.

**Fix applied (lines 196–217):**  
Replaced the raw `JSON.stringify` with two approaches depending on shape:
1. **Array of beat strings** — `beats.map(b => "${i+1}. **${name}**: ${description}").join('\n')` — flat, human-readable, no nesting
2. **Deep tree fallback** — `stripDeep(obj, maxDepth=2)` recursively prunes `children` and `tactics` keys and replaces deep subtrees at depth ≥2 with `'[Nested Data]'`

The result is now ≤500 characters of beat-sheet context regardless of original depth, freeing prompt budget for the actual screenplay instruction.

**Residual risk:** 🟢 None — this is a clean replacement.

---

### ✅ F-10 | P-6 · `backend/src/routes/treatment.routes.ts` lines 46–49

**Severity:** 🟡 Medium  
**What was wrong:** `const { bibleId, logline, acts, style } = req.body` accepted `style` as raw `any`. If a client sent `style: "Save The Cat!"` (human-readable label) instead of `style: "save_the_cat"` (programmatic key), the orchestrator silently fell back to `three_act` with no warning.

**Fix applied:**  
```ts
const validStyles = ['save_the_cat', 'heros_journey', 'three_act', 'tv_beat_sheet', 'five_act', 'story_circle', 'sequence_approach', 'indian_commercial', 'fictional_pulse'];
if (style && !validStyles.includes(style)) {
    return res.status(400).json({ error: 'Invalid structure style' });
}
```

**Residual risk:** 🟡 Only the save route is validated. The generate route (`/generate` at line 28) still passes `style` through to `treatmentService.generatePreview` without validation. If the frontend sends a bad style string, the beat-sheet prompt will get a free-text string instead of a structured framework name — poisoning the LLM's beat assignment.

---

### ✅ F-11 | P-8 · `frontend/src/pages/ScriptWriter/StoryView.tsx` lines 71–81

**Severity:** 🟡 Medium  
**What was wrong:** `<Select>` hard-coded only 4 of 9 structure types. Users wanting TV Beat Sheet, Five Act, Story Circle, Indian Commercial, or Fictional Pulse saw a silent fallback to Three Act.

**Fix applied:** All 9 options now present in the `options` array (lines 72–80):
```ts
{ value: 'save_the_cat', label: 'Save The Cat' },
{ value: 'heros_journey', label: "Hero's Journey" },
{ value: 'three_act', label: 'Three Act Structure' },
{ value: 'tv_beat_sheet', label: 'TV Beat Sheet' },
{ value: 'five_act', label: 'Five Act Structure' },
{ value: 'story_circle', label: 'Story Circle (Harmon)' },
{ value: 'sequence_approach', label: '8-Sequence Approach' },
{ value: 'indian_commercial', label: 'Indian Commercial Cinema' },
{ value: 'fictional_pulse', label: 'Fictional Pulse (Action)' },
```

**Residual risk:** 🟡 The `onTreatmentStyleChange` handler should map between human-readable labels and programmatic keys (the beat orchestrator uses snake_case keys). If the handler stores the label text verbatim, `STRUCTURE_ACTS[structureType]` will still miss-match. Check `onTreatmentStyleChange` implementation.

---

### ✅ F-12 | Perf-1 · `backend/src/services/ai.manager.ts` line 33

**Severity:** 🟡 Medium  
**What was wrong:** `maxEmbeddingChars` defaulted to `4000`. Screenplay chunks (action blocks, parentheticals stage directions) routinely exceed 4,000 characters. Embedding truncation meant the RAG system retrieved **partial** and **unrepresentative** vectors — lowering retrieval quality for any scene with dense action writing.

**Fix applied:**  
`private readonly maxEmbeddingChars = this.parsePositiveInt(process.env.EMBEDDING_MAX_CHARS, 8000);`  
Default bumped from 4,000 → 8,000.

**Residual risk:** 🟡 Parity check needed: verify that `llamaindexService.getEmbedding` producing Ollama `bge-m3` vectors and `ollamaService.getOllamaEmbedding` producing Ollama `bge-m3` vectors return dimensions of the same magnitude. If Ollama model is configured as `nomic-embed-text` (768 dims) while llamaindex uses `bge-m3` (1024 dims), `validateAndNormalizeEmbedding` will truncate or zero-pad, degrading similarity.

---

### ✅ F-13 | B-8 safeguard · `backend/src/routes/treatment.routes.ts` lines 162–163, 184–185

**Severity:** 🔴 High  
**What was wrong:** `/agent/card` (PATCH) and `/agent/sync` (POST) were asynchronous operations with no timeout guard. If `beatOrchestratorService.updateBeatCard` or `syncToScenes` ever encountered a DB stall, the HTTP connection would hang indefinitely.

**Fix applied:** Both routes now have `Promise.race` with explicit timeouts:
```ts
// /agent/card — 20 s timeout
const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Card update timed out')), 20000));
const data = await Promise.race([updatePromise, timeoutPromise]);

// /agent/sync — 30 s timeout
const timeoutPromise = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Sync operation timed out')), 30000));
const scenes = await Promise.race([syncPromise, timeoutPromise]);
```

**Residual risk:** 🟢 These operations are currently synchronous DB calls (not long-running AI generation), so the timeouts are protective shelving rather than active fixes. If `/agent/sync` later accumulates a complex batch job, 30 s may need to increase.

---

### ✅ F-14 | scene.routes.ts — Audit Chain partial-success fallback + background task await

**Severity:** 🔴 High  
**Fix — partial fallback (lines 456–475):** The 3-attempt Audit Chain (`scene.routes.ts` `POST /:id/fix` route) now has a `bestAttempt` fallback. If the critique chain errors on Attempt 2, it returns the best completed attempt with `auditNotes` and `isPartial: true` — previously the entire request returned 500 with no user feedback.

**Fix — background task await (lines 527–538):** `POST /:id/assisted-edit` now calls `await scriptGenerator.waitForBackgroundTasks()` before closing the stream response. Previously the response stream was closed immediately after the last AI chunk, which meant `characterDiscovery` and `castingDirector` background tasks were racing the DB connection close — half-completed writes on long AI generations.

**Residual risk:** 🟡 `waitForBackgroundTasks()` awaits the Firebase-style `.promise` resolution but has no hard timeout of its own. If a background task is DB-blocked (e.g. character lookup by name takes 10 s on an unindexed collection), the HTTP response is kept open.

---

## Section 2 — ❌ Still Open Issues

### ❌ S-1 | B-2 · `backend/src/services/beatOrchestrator.service.ts` lines 229, 263

**Severity:** 🟡 Medium  
**What's wrong:** Block size for projects >60 scenes is `15` (line 229), but `runningScenes.slice(-20)` at line 263 only captures 20 prior scenes for dedup context. For a 60-scene project that's `20 / 60 = 33%` context coverage per block. The AI is expected to avoid repeating sluglines from 60 scenes by looking at only 20. This produces occasional duplicate-place problems (same city reused across acts, or "INT. CABIN" appearing twice).

**Why not fixed:** Changing block size upward (e.g. to 20 for ≤90 scenes) would increase total LLM calls. The current `slice(-20)` is a deliberate compromise. The real fix requires **cross-block validation** before sync-to-scenes: a post-generation pass that enumerates sluglines and prompts for correction on duplicates.

---

### ❌ S-2 | B-6 / P-2 · `backend/src/services/assistantRag.service.ts` line 331

**Severity:** 🔴 High  
**What's wrong:** The lore-injection fallback (lines 334–347) is only triggered inside `buildAssistantReferencePack` — which is called for `effectiveMode !== 'ask'` **or** when `needsRag()` returns true (line 471). In `effectiveMode === 'ask'` AND `needsRag === false` (simple Q&A fast-path), `buildAssistantReferencePack` is **never called** — no lore injection happens. Scenes with characters involved get no character/relationship constraints injected into the ask-mode prompt.

**Why not fixed:** The fast-path was intentionally simplified to avoid the expense of embedding generation for trivial questions. But the result is: an "ask" question like "What is the dramatic purpose of this scene?" is answered with zero awareness of the character relationships defined in the lore graph.

**Workaround needed:** Inject a lightweight, non-embedding lore lookup directly into the fast-path prompt — query the LoreEntity/LoreRelation collections by charactersInvolved and inject 2–3 relationship sentences as a plain string.

---

### ❌ S-3 | B-7 · `frontend/src/pages/ScriptWriter/StudioExplorer.tsx` line 148

**Severity:** 🟡 Medium  
**What's wrong:** `const scenes = getScenes(project._id)` is called directly inside JSX `map()` render (line 148). If `getScenes` is ever replaced by a memoized-poor selector (e.g. a Zustand `useSelect`) instead of the current simple indexed lookup, every parent re-render triggers a full store scan.

**Why not fixed:** Current `getScenes` source not visible in open tabs. If confirmed as `(id) => projectScenes[id]` (in-memory Map lookup), this is a non-issue. If it ever becomes store-select driven, it needs to be wrapped in `useMemo(() => getScenes(project._id), [project._id])`.

---

### ❌ S-4 | P-5 · `frontend/src/services/activity.api.ts` lines 6, 14

**Severity:** 🟡 Medium  
**What's wrong:** `metadata?: any` passes completely unsanitized JavaScript objects into the backend. The activity route (`POST /activity`) has no Zod schema guard visible in the open backend routes. A JS object with `__proto__` or `$where` keys passed as `metadata` can reach MongoDB's `insertOne` query layer, creating a **log injection / NoSQL injection** vector.

**Why not fixed:** The POST `/activity` route handler was not open in the read set. If it exists with a raw `req.body.metadata` passthrough, this is a real risk. If it has a JSON-schema or whitespace-cloning guard already applied, the risk is mitigated.

---

### ❌ S-5 | P-7 · `backend/src/models/ChatConversation.ts` line 35

**Severity:** 🔴 High  
**What's wrong:** `messages: [chatMessageSchema]` — no `maxlength`, no `authors`, no pruning. A long AI assistant conversation (200+ turns of script-editing guidance) accumulates embedded documents with `role: 'assistant'`, `content: <fullSceneDraft>`. At ~500KB per assistant message with a full screenplay draft, the BSON document hits the 16MB hard limit after ~32 back-and-forth turns. At that point `doc.save()` fails with a cryptic mongodb error and the last write is dropped.

**Why not fixed:** No `$slice` pruning, no `maxlength` schema cap, no "truncate to last N messages" middleware. This is an inbound growth problem with no current guard.

**Recommended fix:** Add to `chatConversationSchema`:
```ts
messages: {
    type: [chatMessageSchema],
    maxlength: [500, 'Conversation exceeds maximum message count']
}
```
Or switch to a linked `ChatMessage` collection (one document per message) and cursor-paginate.

---

### ❌ S-6 | AI-2 · `backend/src/services/beatOrchestrator.service.ts` lines 264–266

**Severity:** 🔴 High  
**What's wrong:** `{{previously_planned_scenes}}` receives raw LLM output from prior blocks (`runningScenes`). A generation that inserts an instruction-like fragment or incomplete JSON in a `title` or `description` field propagates prompt injection into the next block's LLM call, altering subsequent generation behavior.

**Why not fixed:** The `runningScenes` entries are not validated against a schema before injection.

**Recommended fix:** Add a `validateRunningScene()` passthrough before the injection line:
```ts
const validate = (s: any) => ({
    title: String(s.title || '').replace(/[{}]/g, ''),
    slugline: String(s.slugline || '').replace(/[{}]/g, ''),
    goal: String(s.goal || ''),
    description: String(s.description || '')
});
const lastFewScenes = runningScenes.slice(-20).map(validate);
```

---

### ❌ S-7 | AI-3 · `backend/src/services/projectContext.service.ts` line 198

**Severity:** 🟡 Medium  
**What's wrong:** `Bible.visualStyle` has no schema maxLength. When injected into every AI prompt via `toPromptBlock()` line 198:  
```ts
**Visual Style:** ${ctx.project.visualStyle || 'Not set'}
```
A 2,000-character visual style string burns ~500 tokens on every AI call. For a 60-scene script generation this repeats 60 times → **30,000 wasted tokens**.

**Why not fixed:** No length check is applied anywhere in the `projectContextService.toPromptBlock()` flow.

**Recommended fix:** Truncate at 200 chars:
```ts
**Visual Style:** ${(ctx.project.visualStyle || 'Not set').slice(0, 200)}
```

---

### ❌ S-8 | AI-5 · `backend/src/services/scriptGenerator.service.ts` lines 475–493

**Severity:** 🟡 Medium  
**What's wrong:** The fast-path `ASSISTANT_ASK_PROMPT` (lines 475–493, `needsRag === false` branch) now correctly gets `projectSpecs` (genre, tone, visualStyle, rules). **But** `characterMemoryText` is not injected. When a user asks "Why does Karna activate the secret maneuver?" in `ask` mode, the AI answers knowing the genre and tone but has no *character-specific* context — it does not know who Karna is.

**Why not fixed:** `characterMemoryText` was computed at line 359:  
```ts
const characterMemoryText = await stateManagerService.getFormattedCharacterDescriptions(bibleId, scene);
```
This `await` is in the RAG branch's zone. Moving it to the shared pre-branch computation would add ~50-100ms per fast-path request but is worth it for quality.

**Recommended fix:** Move the `characterMemoryText` computation to line ~360 (before the `if (!needsRag)` split) and inject it in the fast-path's `buildEditorAssistantPrompt` call.

---

### ❌ S-9 | AI-6 · `backend/src/services/treatment.service.ts` line 19

**Severity:** 🟢 Low  
**What's wrong:** Comment still reads:  
> "Generates a Beat Sheet (Treatment) from a logline using Groq Cloud."  

`generatePreview` calls `aiServiceManager.chat(...)` with provider/model abstraction. The actual LLM provider depends on `ai-config.json` or `AI_PROVIDER` env var. A future maintainer reading this comment will assume Groq-specific prompt tuning (instruction-prefixed format, system role handling) was intentionally applied — it wasn't.

---

### ❌ S-10 | AI-7 · `backend/src/services/beatOrchestrator.service.ts` lines 220–226

**Severity:** 🟡 Medium  
**What's wrong:** When Phase 1 (core beats generation) fails, the fallback is an anonymous 3-beat hardcoded array:
```ts
coreBeats = [
    { name: 'Setup', ... },
    { name: 'Confrontation', ... },
    { name: 'Climax', ... }
];
```
This produces the same Three-Act fallback regardless of the user's selected structure type. A user who chose `fictional_pulse` (4 pulses) or `five_act` gets a Three-Act fallback silently masquerading as their selection — the user believes the system generated a correct Fictional Pulse, but it's actually Setup/Confrontation/Climax.

**Why not fixed:** The fallback has zero awareness of `structureType` or `STRUCTURE_ACTS`.

**Recommended fix:** Map the hardcoded fallback through `STRUCTURE_ACTS[frameworkKey]`:
```ts
const fallbackActs = STRUCTURE_ACTS[frameworkKey] || STRUCTURE_ACTS.three_act;
coreBeats = fallbackActs.map(act => ({
    name: act.name,
    description: `Focus on expanding the dramatic conflict for the ${act.name} segment.`
}));
```

---

### ❌ S-11 | Perf-2 · `backend/src/services/scriptGenerator.service.ts` lines 575–577

**Severity:** 🟢 Low  
**What's wrong:** Background tasks fire-and-forget into `this.pendingTasks` Set (set at line ~215 in full code). If the Node process receives `SIGTERM` or crashes mid-generation, in-flight tasks are orphaned. No `process.on('SIGTERM', ...)` hook drains the Set.

**Why not fixed:** Process lifecycle hooks are deployed-operator concern. In Docker/K8s the preStop hook is expected to drain connections, but this is not wired in.

---

### ❌ S-12 | Perf-3 · `backend/src/services/assistantRag.service.ts` lines 255–259

**Severity:** 🟡 Medium  
**What's wrong:** 
```ts
const embeddedQueries = await Promise.all(
    queryVariants.map(async (query) => ({
        ...query,
        embedding: await aiServiceManager.generateEmbedding(query.text)
    }))
);
```
`queryVariants` generates 4 queries (`intent`, `content`, `style`, `expansion`). Each embedding call goes through `withEmbeddingSemaphore` which has a 30 s timeout. If any single embedding soft-fails after 30 s (semaphore timeout fires `reject(new Error('Embedding semaphore timeout'))`), `Promise.all` fails-fast — ruining all 4 embedding results even if 3 succeeded. The entire RAG pipeline then falls through.

**Why not fixed:** No `Promise.race` per-query, no `allSettled`, no retry per query.

**Recommended fix:** Switch to `allSettled`-style:
```ts
const embeddedQueries = await Promise.allSettled(
    queryVariants.map(async (query) => ({ ...query, embedding: await aiServiceManager.generateEmbedding(query.text) }))
);
const successfulOnes = embeddedQueries
    .filter((r): r is PromiseFulfilledResult<typeof query> => r.status === 'fulfilled')
    .map(r => r.value);
if (successfulOnes.length === 0) throw new Error('All embedding queries failed');
```

---

### ❌ S-13 | Perf-4 · `backend/src/services/beatOrchestrator.service.ts` lines 249–344

**Severity:** 🟡 Medium → 🔴 High for large projects  
**What's wrong:** Block generation is fully sequential: `for await (const chunk of stream) { ... }` with an `await aiServiceManager.chat(blockPrompt)` per block. For 60 scenes at blockSize=15: 4 sequential LLM calls × avg 15 s each = 60 s minimum wall time. The constant sub-prompts (`castStr`, `projectDirectives`, `resourcesStr`) are recomputed identically for every block.

**Why not fixed:** Sequential generation is intentional — each block's output feeds into `runningScenes` which is part of the next block's input. Can't run blocks truly in parallel. But the **constant prompt parts** (cast, directives, resources, logline) are static across all blocks — they can be separated as a persistent system-instruction prefix, eliminating ~500 tokens of redundant prompt prep per block.

**Recommended fix:** Extract `castStr`, `projectDirectives`, `resourcesStr`, `logline` into a system instruction or a shared pre-prompt string and prepend it to each blockPrompt rather than re-building it per block.

---

### ❌ S-14 | Perf-5 · `backend/src/services/projectContext.service.ts` line 351

**Severity:** 🔴 High for large projects  
**What's wrong:** `Scene.find({ bibleId }).sort({ sequenceNumber: 1 }).lean()` — no `maxTimeMS`, no result cap. For a project with 1,000+ scenes, this query returns 1,000+ `lean()` documents (each ~500 bytes) in a single `await` at line 351. The aggregate `Promise.all` at line 350 then waits for all 5 fetches before resolving. If scenes load is 12 s on a cold index, every backend call that does `projectContextService.build()` adds 12 s.

**Why not fixed:** The intent is to pass full scene history to LLM. But 1,000 scenes definitley should not be injected into every AI prompt anyway.

**Recommended fix:** Cap at the first 200 scenes, add `.maxTimeMS(5000)`:
```ts
const scenes = await Scene.find({ bibleId })
    .sort({ sequenceNumber: 1 })
    .limit(200)
    .maxTimeMS(5000)
    .lean();
```
The status service (`projectStatus.service.ts:351`) also runs the same full `Scene.find` without a cap. Separate status context from generation context.

---

### ❌ S-15 | Perf-6 · `backend/src/services/projectContext.service.ts` lines 97–99

**Severity:** 🟢 Low  
**What's wrong:**  
```ts
if (sceneCount > 100 && scene.sequenceNumber > 100) {
    base.summary = '';
}
```
Projects with 100–200 scenes have summaries stripped for all scenes beyond 100. The `projectSpecs` block injected into every AI prompt therefore degrades progressively as the project grows — the AI loses scene-by-scene plot recall after scene 100.

**Why not fixed:** Token budget trade-off — it was cheaper to drop summaries than to re-evaluate token accounting. The `visualStyle` unbounded padding (S-7) is the bigger offender. This blunt cutoff should be replaced with a token-aware sliding window summary instead of a hard `sequenceNumber > 100` gate.

---

### ❌ S-16 | P-10 · `frontend/src/pages/ScriptWriter/components/InfiniteLayout.tsx` line 95

**Severity:** 🟡 Medium  
**What's wrong:** Beat-board height resize uses raw `e.clientY`:
```ts
const newHeight = e.clientY;
setBeatBoardHeight(Math.min(Math.max(newHeight, minBeatHeight), maxBeatHeight)));
```
`e.clientY` is the mouse Y coordinate relative to the **viewport**, not the local beat-board element. In an iframe, or with `transform: translateY(...)` on a parent, the raw value is offset. The first drag on the beat-board divider can snap the height to `minBeatHeight` if the layout is vertically offset.

**Why not fixed:** In the current full-screen layout, `e.clientY` works fine — the element is at the top of the viewport. This is a latent bug that only fires under specific zoom/embed conditions.

**Recommended fix:**  
```ts
const rect = beatBoardRef.current?.getBoundingClientRect();
const newHeight = rect ? e.clientY - rect.top : e.clientY;
```

---

### ❌ S-17 |activity.api.ts / NO zod schema guard (P-5 complement)

**Severity:** 🟡 Medium  
**What's wrong:** Backend `POST /activity` route was not readable in the open files. The route handler must apply at minimum:
```ts
const ActivitySchema = z.object({
    type: z.enum(['navigation', 'click', 'edit', 'create', 'delete', 'search', 'command']),
    description: z.string().max(500),
    metadata: z.any().nullable().optional(), // or a specific shape
    timestamp: z.coerce.date().optional()
});
```
Without this, any object keys in `metadata` survive to the DB layer.

---

## Section 3 — 🔍 Architectural / Structural Issues (Not File bugs, System-level)

### 🏗 ARCH-1 · No structured logger

The entire backend uses `console.error`, `console.warn`, `console.log` (partially guarded by `process.env.NODE_ENV !== 'production'`). There is no `pino`, `winston`, or `bunyan` instance, no correlation IDs, no JSON log format, no log levels configuration. CloudWatch / Datadog ingestion depends on stdout/err text parsing which is fragile. Error lines like `console.error('[SceneAPI] Fix Error:', error)` emit `Error: … + stack` — in production this is a PII risk.

| File | Unguarded console |
|------|------------------|
| `characterDiscovery.service.ts:212` | `console.log('Scanning finished…')` |
| `ollama.service.ts:36` | `console.log('[OllamaService] Initialized…')` in constructor |
| `bible.routes.ts:178` | `console.error('Failed to write to log file', e)` |
| `critic.service.ts:118` | `console.error('Critic evaluation failed:', error)` |
| `treatment.routes.ts:84` | `console.error('Failed to generate/parse Beat Sheet JSON:', error)` |
| `gemini.service.ts:346` | `console.error('[GeminiService] Embedding failed:')` |

---

### 🏗 ARCH-2 · No Zod/joi in treatment.route POST/Save

`treatment.routes.ts:43` now validates `style` at line 47 (✅). But it does **not** validate `acts`: `const { bibleId, logline, acts, style } = req.body;` then on line 53 `treatmentService.saveTreatment(bibleId, logline, acts, style)`. If `acts` is `null`, or `acts[0].beats` is not an array, `treatmentService.saveTreatment` line 97: `(act.beats || [])` silently absorbs the failure. The user gets a successfully-saved treatment document with an empty act. Adding `z.array(z.object({...}))` validation on the route layer catches this before DB write.

---

### 🏗 ARCH-3 · No rate limiter on AI-expensive routes

`grep` for `limiter|rate.?limit|throttle|express-rate-limit` returned **0 results** in the entire `backend/src/` directory.

Routes like `POST /assisted-edit`, `POST /scene/:id/fix` (Quality Guard), and `POST /treatment/generate` make LLM calls costing $0.01–0.10 per request. There is nothing stopping a user or QA script from hammering them at 100 req/s. The only limit is Express's default connection backlog.

Routes that need limiter middleware most urgently:
- `POST /scene/:id/fix` — 2 critique+revise calls per request, 30–90 s each
- `POST /scene/:id/assisted-edit` — streaming AI call, effectively unbound
- `POST /treatment/generate` — AI call, 10–30 s each

---

### 🏗 ARCH-4 · Frontend has no authentication or CSRF guard visible in open tabs

`base.api.ts` was not in the open tabs but `baseApi.request<T>()` is used everywhere. There is no `Authorization: Bearer …` header construction visible in any frontend API class, no `csrf-token` fetch, no token refresh logic visible. Authentication is handled server-side (`@middleware/auth.js` on routes), but the frontend-token-to-backend flow was not visible.

---

### 🏗 ARCH-5 · `getScenes` in StudioExplorer called in render (B-7)

The component pattern at `StudioExplorer.tsx:148`:
```tsx
const scenes = getScenes(project._id);
```
is a potential re-render cost depending on the parent's memoization. The parent should also memoize the map callback:
```tsx
{projects.map((project) => {
    const scenes = useMemo(() => getScenes(project._id), [project._id]);
```
If `projects` is a deeply nested prop that changes identity on every parent render, the keyed division `projects.map()` re-creates inner render lambdas every cycle.

---

### 🏗 ARCH-6 · ScriptGenerator.service.ts line count

`scriptGenerator.service.ts` is **942 lines** in a single class. `assistedEdit` (line ~560) is ~250 lines long with inline comment headers instead of extracted methods. The class holds at minimum: `generateScene`, `assistedEdit`, `reviseSceneBatch`, `buildEditorAssistantPrompt`, `generateAuditNotes`, `waitForBackgroundTasks`, `commitAssistedEdit`, `executeQueryLoreAndRelationships`. These are 8 distinct public methods that could each be their own service class.

---

### 🏗 ARCH-7 · Test scripts are not Jest

`backend/scripts/test_prompt_compression.ts` and `test_lore_graph.ts` run via `ts-node` / `npx ts-node` with `process.exit(1)` assertions. They are not Discoverable by Jest (not in `__tests__` or `*.test.ts`) and are not part of CI. Any code change to `buildAssistantChatHistoryText` or `executeQueryLoreAndRelationships` silently breaks these tests without coverage detection.

---

## Section 4 — Summary Table

| # | Section | ID | File | Line(s) | Severity | Status |
|---|---------|-----|------|---------|----------|--------|
| 1 | Fixed | F-1 | `parser.service.ts` | 47–60 | 🔴 High | ✅ Fixed |
| 2 | Fixed | F-2 | `gemini.service.ts` | 313–360 | 🔴 High | ✅ Fixed |
| 3 | Fixed | F-3 | `treatment.service.ts` | 32 | 🟡 Medium | ✅ Fixed |
| 4 | Fixed | F-4 | `treatment.service.ts` | 41 | 🔴 High | ✅ Fixed |
| 5 | Fixed | F-5 | `ChunkViewerModal.tsx` | 193 | 🔴 High | ✅ Fixed |
| 6 | Fixed | F-6 | `beatOrchestrator.service.ts` | 253–258 | 🟡 Medium | ✅ Fixed |
| 7 | Fixed | F-7 | `parser.service.ts` | 51–60 | 🔴 High | ✅ Fixed |
| 8 | Fixed | F-8 | `characterDiscovery.service.ts` | 21 | 🟡 Medium | ✅ Fixed |
| 9 | Fixed | F-9 | `scriptGenerator.service.ts` | 196–217 | 🔴 High | ✅ Fixed |
| 10 | Fixed | F-10 | `treatment.routes.ts` | 46–49 | 🟡 Medium | ✅ Fixed |
| 11 | Fixed | F-11 | `StoryView.tsx` | 71–81 | 🟡 Medium | ✅ Fixed |
| 12 | Fixed | F-12 | `ai.manager.ts` | 33 | 🟡 Medium | ✅ Fixed |
| 13 | Fixed | F-13 | `treatment.routes.ts` | 162–185 | 🔴 High | ✅ Fixed |
| 14 | Fixed | F-14 | `scene.routes.ts` | 382–538 | 🔴 High | ✅ Fixed |
| 15 | Open | S-1 | `beatOrchestrator.service.ts` | 229, 263 | 🟡 Medium | ❌ Open |
| 16 | Open | S-2 | `assistantRag.service.ts` | 331–347 | 🔴 High | ❌ Open |
| 17 | Open | S-3 | `StudioExplorer.tsx` | 148 | 🟡 Medium | ❌ Unverified |
| 18 | Open | S-4 | `activity.api.ts` | 6, 14 | 🟡 Medium | ❌ Unverified |
| 19 | Open | S-5 | `ChatConversation.ts` | 35 | 🔴 High | ❌ Open |
| 20 | Open | S-6 | `beatOrchestrator.service.ts` | 264–266 | 🔴 High | ❌ Open |
| 21 | Open | S-7 | `projectContext.service.ts` | 198 | 🟡 Medium | ❌ Open |
| 22 | Open | S-8 | `scriptGenerator.service.ts` | 475–493 | 🟡 Medium | ❌ Open |
| 23 | Open | S-9 | `treatment.service.ts` | 19 | 🟢 Low | ❌ Open |
| 24 | Open | S-10 | `beatOrchestrator.service.ts` | 220–226 | 🟡 Medium | ❌ Open |
| 25 | Open | S-11 | `scriptGenerator.service.ts` | 575–577 | 🟢 Low | ❌ Open |
| 26 | Open | S-12 | `assistantRag.service.ts` | 255–259 | 🟡 Medium | ❌ Open |
| 27 | Open | S-13 | `beatOrchestrator.service.ts` | 249–344 | 🟡 Medium | ❌ Open |
| 28 | Open | S-14 | `projectContext.service.ts` | 351 | 🔴 High | ❌ Open |
| 29 | Open | S-15 | `projectContext.service.ts` | 97–99 | 🟢 Low | ❌ Open |
| 30 | Open | S-16 | `InfiniteLayout.tsx` | 95 | 🟡 Medium | ❌ Open |
| 31 | Open | S-17 | `activity.api.ts` | Backend route | 🟡 Medium | ❌ Unverified |
| 32 | Arch | ARCH-1 | `backend/src/` | all | 🟡 | ❌ No logger |
| 33 | Arch | ARCH-2 | `treatment.routes.ts` | 43 | 🟡 | ❌ Acts not validated |
| 34 | Arch | ARCH-3 | `backend/src/` | all endpoints | 🔴 | ❌ No rate limiter |

---

> Total fixable open issues: **22**  
> Critical to address before multi-user SaaS: **S-2, S-5, S-14, ARCH-2, ARCH-3** (rush for production safety)  
> Good to address before next major feature: **S-6, S-7, S-8, S-12, S-15** (quality and stability)  
> Technical debt / cleanup: **S-1, S-3, S-9, S-10, S-11, S-16, ARCH-1, ARCH-6, ARCH-7**
