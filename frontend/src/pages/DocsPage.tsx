import { useState } from 'react';

interface DocFile {
  name: string;
  path: string;
  category: 'Backend Core' | 'AI & RAG Services' | 'Frontend Architecture' | 'Databases & Infrastructure';
  description: string;
  keyFunctions: string[];
  codePreview: string;
  interrogationDefense: string;
  localLink: string;
}

const FILES_DOCS: DocFile[] = [
  {
    name: 'index.ts',
    path: 'backend/src/index.ts',
    category: 'Backend Core',
    description: 'The core server entry point. Sets up Express middleware, helmet security headers, NoSQL injection sanitizers, database connections, and custom stream routing.',
    keyFunctions: [
      'compression() bypass: Custom middleware filter checking res.getHeader("x-no-compression") to disable Gzip and enable zero-delay streaming chunks.',
      'mongoose.connect(): Handles active connection handshakes with database VM clusters.',
      'Express middleware stack: Integrates helmet, xss-clean, and body parsers.'
    ],
    codePreview: `// Live Code Snippet: Custom Stream Compression Bypass Filter
const shouldCompress = (req: Request, res: Response) => {
  if (req.headers['x-no-compression'] || res.getHeader('x-no-compression')) {
    return false; // Yield chunks instantly without Gzip buffering delay
  }
  return compression.filter(req, res); // Default compression
};`,
    interrogationDefense: 'Explain how the compression bypass prevents "net::ERR_INCOMPLETE_CHUNKED_ENCODING" by stopping Express from caching and holding real-time Server-Sent Events (SSE) tokens in buffer memory.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/index.ts'
  },
  {
    name: 'rag/index.ts',
    path: 'backend/src/services/rag/index.ts',
    category: 'AI & RAG Services',
    description: 'The heart of the AI Story Bible and Style Sync. Determines if an instruction needs semantic database injection, embeds expanded query variants, and parallel-queries multiple databases.',
    keyFunctions: [
      'needsRag(instruction): Runs regex tests to check if the user request is a simple Q&A (bypassing RAG) or a script edit/writing block (activating RAG).',
      'buildAssistantReferencePack(params): Co-ordinates the complete RAG lifecycle: multi-query variant generation, parallel Voyage AI embeddings, Qdrant/MongoDB candidate checks, quotas ranking, and final prompt stitching.',
      'RagCache: In-memory store preventing redundant calls on rapid consecutive edits.'
    ],
    codePreview: `// RAG Concurrency & Safe Embeddings
const embeddedQueries = await Promise.all(
  queryVariants.map(async (query) => {
    const embeddingPromise = aiServiceManager.generateEmbedding(query.text);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('Timeout'), 15000));
    const embedding = await Promise.race([embeddingPromise, timeoutPromise]); // Timeout safeguard
    return { ...query, embedding };
  })
);`,
    interrogationDefense: 'Highlight your parallel promise execution and the 15-second Promise.race timeout safeguard to prevent database lookup stalls if Voyage AI embeddings slow down.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/services/rag/index.ts'
  },
  {
    name: 'driftScanner.service.ts',
    path: 'backend/src/services/driftScanner.service.ts',
    category: 'AI & RAG Services',
    description: 'Highly specialized script continuity auditor. Cross-references the active screenplay lines against state parameters logged in the Character MongoDB collection.',
    keyFunctions: [
      'scan(text, characterContext): Checks screenplay lines for active character mentions, verifying if their actions contradict status conditions.',
      'findDirectContradictions(lines, charName, status): Uses regex patterns matching verbs (e.g. walks, speaks, runs) to flag if a character listed as "Dead" or "Unconscious" is performing active physical actions.'
    ],
    codePreview: `// Continuity Verbs Audit
const actionVerbs = ['walks', 'runs', 'speaks', 'says', 'grabs', 'holds'];
if (currentStatus === 'Dead' || currentStatus === 'Unconscious') {
  const actionPattern = new RegExp(\`\${charName}\\\\s+(?:\&{actionVerbs.join('|')})\`, 'i');
  if (line.match(actionPattern)) {
    drifts.push({ severity: 'high', message: 'Dead character is performing actions.' });
  }
}`,
    interrogationDefense: 'Defend this as a custom, database-to-text semantic validation system that keeps the LLM narrative fully coherent across long-form script sequences.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/services/driftScanner.service.ts'
  },
  {
    name: 'screenplayValidator.service.ts',
    path: 'backend/src/services/screenplayValidator.service.ts',
    category: 'AI & RAG Services',
    description: 'Stateful screenplay parsing compiler. Evaluates scene text line-by-line, enforcing Writers Guild of America (WGA) styling margins, and catching passive tells.',
    keyFunctions: [
      'validate(text, castList): Statefully loops over script lines, tracking character dialogue cues, checking sluglines, and logging issues.',
      'NARRATIVE_VIOLATIONS check: Audits action descriptions against passive "we see" cues and thoughts tells ("he thinks").',
      'BANNED_PATTERNS block: Strips out Markdown bold headers or HTML tags generated by LLMs.'
    ],
    codePreview: `// WGA Slugline and Markdown Bold Scrubber
const BANNED_PATTERNS = [
  { pattern: /\\*\\*/, message: 'Markdown bold (**) found. Use plain UPPERCASE.' },
  { pattern: /<center>/, message: 'HTML center tags found. Use WGA margin indentation.' }
];`,
    interrogationDefense: 'Discuss how the validator handles state statefully across iterations (remembering the active character block). Acknowledge that the regex-based line scanning has limitations, and a full Tokenizer + AST parser represents the scalable next step.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/services/screenplayValidator.service.ts'
  },
  {
    name: 'loreSync.service.ts',
    path: 'backend/src/services/loreSync.service.ts',
    category: 'AI & RAG Services',
    description: 'Graph lore sync pipeline. Transforms flat character sheets in MongoDB into relational graph collections (LoreEntity and LoreRelation) to construct dense prompt contexts.',
    keyFunctions: [
      'syncCharacter(char): Upserts LoreEntity node and parses dynamic relationships, using AI classification to categorize relationship strings.',
      'classifyRelationshipWithAI(text): Classifies arbitrary text descriptions of bonds (e.g. "Sarah loves John") into strict graph relationships (e.g. "allied_with").',
      'deleteCharacterSync(bibleId, name): Cascades deletes across directed relationship edges when a character is deleted.'
    ],
    codePreview: `// AI-Driven Graph Relationship Classifier
export function classifyRelationshipWithAI(text: string) {
  const prompt = \`Classify: "\${text}". Return ONLY JSON: {"type": "hates"|"allied_with"}\`;
  return aiServiceManager.chat(prompt, { format: 'json', temperature: 0 });
}`,
    interrogationDefense: 'Explain how eventual consistency works here: We write to MongoDB instantly to keep the user interface fully responsive, while the AI relationship graphs sync in background processes.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/services/loreSync.service.ts'
  },
  {
    name: 'script.routes.ts',
    path: 'backend/src/routes/script.routes.ts',
    category: 'Backend Core',
    description: 'Express routes facilitating real-time screenplay generation. Emits server-sent text streams directly to the script writer UI.',
    keyFunctions: [
      'router.get("/generate/:id"): Sets custom x-no-compression bypass headers, disables TCP delays, and pipes LLM stream chunks.',
      'Streaming buffer configuration: Sets Content-Type to text/plain; charset=utf-8 and flushes headers immediately.'
    ],
    codePreview: `// Bypass compression for real-time text stream
res.setHeader('Content-Type', 'text/plain; charset=utf-8');
res.setHeader('Cache-Control', 'no-cache, no-transform');
res.setHeader('Connection', 'keep-alive');
res.setHeader('x-no-compression', 'true');
res.socket?.setNoDelay(true);
res.flushHeaders();`,
    interrogationDefense: 'Defend the streaming setup by explaining that standard gzip-buffered middleware holds chunk data in a 16KB window. The explicit headers bypass buffering to ensure words render instantly in the browser without ERR_INCOMPLETE_CHUNKED_ENCODING timeouts.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/routes/script.routes.ts'
  },
  {
    name: 'treatment.routes.ts',
    path: 'backend/src/routes/treatment.routes.ts',
    category: 'Backend Core',
    description: 'Beat sheet and outline coordination controllers. Manages step-by-step scene plot points and structures.',
    keyFunctions: [
      'router.put("/:id/beats"): Updates active plot beats inside the screenplay hierarchy.',
      'router.get("/:id/critique"): Leverages the Story Director LLM agent to review pacing, conflict, and character distribution.'
    ],
    codePreview: `// Establish compression bypass and generate stream
router.get('/:projectId/critique', async (req, res) => {
  res.setHeader('x-no-compression', 'true');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const stream = await criticService.generateCritiqueStream(req.params.projectId);
  for await (const chunk of stream) {
    res.write(chunk);
  }
  res.end();
});`,
    interrogationDefense: 'Demonstrate that the Story Director critique leverages structured system instructions and streaming chunk pipelines to avoid browser connection drops during heavy narrative analysis cycles.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/routes/treatment.routes.ts'
  },
  {
    name: 'bible/ai.ts',
    path: 'backend/src/routes/bible/ai.ts',
    category: 'AI & RAG Services',
    description: 'AI assistant router for project lore and character sheets. Orchestrates dynamic context queries on the Story Bible.',
    keyFunctions: [
      'router.post("/chat"): Accepts conversational queries, triggers LlamaIndex or native semantic search, and streams answers.',
      'Context injection: Restricts RAG injection scope to entities within the user\'s active Project Bible.'
    ],
    codePreview: `// Lore Assistant RAG chat gateway
router.post('/chat', async (req, res) => {
  const { message, bibleId } = req.body;
  res.setHeader('x-no-compression', 'true');
  const responseStream = await bibleAiService.streamChat(message, bibleId);
  responseStream.pipe(res);
});`,
    interrogationDefense: 'Explain how RAG queries are isolated by bibleId at the route handler level, preventing information leakage or cross-project data pollution in multi-user workspace accounts.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/routes/bible/ai.ts'
  },
  {
    name: 'scene/ai.ts',
    path: 'backend/src/routes/scene/ai.ts',
    category: 'AI & RAG Services',
    description: 'Handles context-aware scene completions, dialogue revisions, and character voice alignments.',
    keyFunctions: [
      'assistedEdit(req, res): Re-writes dialogue using character-feedback models to match historical vocabulary.',
      'generateScene(req, res): Incorporates surrounding scene nodes to keep narrative drift below strict thresholds.'
    ],
    codePreview: `// Dialogue voice alignment gateway
router.post('/:sceneId/assisted-edit', async (req, res) => {
  res.setHeader('x-no-compression', 'true');
  const { dialogueText, characterId } = req.body;
  const alignedDialogue = await alignmentService.alignVoice(dialogueText, characterId);
  res.json({ alignedDialogue });
});`,
    interrogationDefense: 'Defend this in-context voice correction workflow as a low-cost, zero-latency alternative to fine-tuning LLMs for character-specific dialogue styles.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/routes/scene/ai.ts'
  },
  {
    name: 'App.tsx',
    path: 'frontend/src/App.tsx',
    category: 'Frontend Architecture',
    description: 'Root React Router v7 configuration. Implements code-splitting (lazy-loaded Suspense routes) and manages the dynamic OKLCH color variable space based on custom user preferences.',
    keyFunctions: [
      'ProtectedRoute / PublicRoute: Protects screen views based on active Zustand token sessions.',
      'Dynamic OKLCH Accent Calculator: Syncs visual settings from stores, automatically generating matching system border focus lines and glowing background tints.'
    ],
    codePreview: `// Dynamic OKLCH variables calculations
const parts = accent.oklch.split(' ').map(parseFloat);
root.style.setProperty('--accent', \`oklch(\${parts[0]} \${parts[1]} \${parts[2]})\`);
root.style.setProperty('--accent-soft', \`oklch(\${parts[0]} \${parts[1]} \${parts[2]} / 0.12)\`);`,
    interrogationDefense: 'Defend your choice of React Router code-splitting: Lazy loading larger pages (like the script dashboard and Studio workspace) keeps initial browser package transfers incredibly light.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/frontend/src/App.tsx'
  },
  {
    name: 'authStore.ts',
    path: 'frontend/src/stores/authStore.ts',
    category: 'Frontend Architecture',
    description: 'Global state manager for security authentication, built natively with Zustand hooks to eliminate boilerplate.',
    keyFunctions: [
      'checkAuth(): Auto-checks storage for active JSON Web Tokens (JWT) on workspace hydration.',
      'login() / logout(): Logs users in, writes session properties, and cleans cache states on teardown.'
    ],
    codePreview: `// Lightweight Zustand Session Store
export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  login: (userData, token) => {
    localStorage.setItem('token', token);
    set({ isAuthenticated: true, user: userData });
  }
}));`,
    interrogationDefense: 'Contrast Zustand with Redux. Explain that Zustand is hook-based, needs zero context providers or actions boilerplate, and keeps our state-reactive rendering times at pure peak speed.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/frontend/src/stores/authStore.ts'
  },
  {
    name: 'treatmentStore.ts',
    path: 'frontend/src/stores/treatmentStore.ts',
    category: 'Frontend Architecture',
    description: 'Frontend state store for organizing outline structures, screenplay milestones, and real-time LLM critiques.',
    keyFunctions: [
      'fetchBeats(projectId): Hydrates the storyboard screen with scene outlines.',
      'updateBeatState(beatId): Synchronizes drag-and-drop beat sequences statefully.'
    ],
    codePreview: `// Zustand Beat Sheet state manager
export const useTreatmentStore = create<TreatmentState>((set) => ({
  beats: [],
  loading: false,
  fetchBeats: async (projectId) => {
    set({ loading: true });
    const beats = await api.getBeats(projectId);
    set({ beats, loading: false });
  }
}));`,
    interrogationDefense: 'Defend Zustand\'s multi-store layout. Isolating treatments, script nodes, and auth configurations inside dedicated stores keeps component rerenders isolated and highly performant.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/frontend/src/stores/treatmentStore.ts'
  },
  {
    name: 'User.ts',
    path: 'backend/src/models/User.ts',
    category: 'Databases & Infrastructure',
    description: 'Mongoose Model storing user accounts, JWT credentials, and detailed UI/visual token preferences.',
    keyFunctions: [
      'userSchema: Holds names, encrypted hashes, custom accent hex strings, and theme preferences (light/dark class).',
      'pre("save"): Hashes passwords prior to persistence using high-entropy bcrypt rounds.'
    ],
    codePreview: `// User mongoose schema visual settings
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  theme: { type: String, default: 'dark' },
  accentColor: { type: String, default: 'terracotta' }
});`,
    interrogationDefense: 'Defend storing visual UI preferences in the database by explaining that it enables immediate theme class application and layout styles hydration upon user login, across different browsers.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/models/User.ts'
  },
  {
    name: 'Bible.ts',
    path: 'backend/src/models/Bible.ts',
    category: 'Databases & Infrastructure',
    description: 'Mongoose Model storing lore nodes, world rules, magic system parameters, and outline milestones.',
    keyFunctions: [
      'bibleSchema: Houses references to character profiles, places, events, and project-specific RAG vector indices.',
      'indexing: Powers high-performance filters inside the LLM prompt-stuffing steps.'
    ],
    codePreview: `// Centralised Story Bible context indexing
const BibleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  loreNodes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LoreEntity' }]
});`,
    interrogationDefense: 'Explain how the Bible model acts as a centralized database anchor for RAG injection. Having the loreNodes and project relationships indexed keeps vector queries incredibly localized and cheap.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/models/Bible.ts'
  },
  {
    name: 'Character.ts',
    path: 'backend/src/models/Character.ts',
    category: 'Databases & Infrastructure',
    description: 'Database structure detailing key personality traits, status parameters, visual descriptions, and dialogue logs.',
    keyFunctions: [
      'characterSchema: Contains core properties (e.g. alignment, relationships, physical states) read by the drift continuity engine.',
      'status validation: Tracks state changes (e.g. Alive -> Dead) to maintain screenplay narrative integrity.'
    ],
    codePreview: `// Stateful persona database representation
const CharacterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  bibleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bible', required: true },
  status: { type: String, enum: ['Alive', 'Dead', 'Unconscious'], default: 'Alive' },
  traits: [String]
});`,
    interrogationDefense: 'Highlight that using state fields in the character schema allows deterministic, fast validation in our continuous scanning services, bypassing slow and costly LLM evaluations.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/models/Character.ts'
  },
  {
    name: 'CharacterFeedback.ts',
    path: 'backend/src/models/CharacterFeedback.ts',
    category: 'Databases & Infrastructure',
    description: 'Mongoose schema mapping user-supplied voice correction data. Serves as the database foundation for the In-Context Alignment Feedback Loop.',
    keyFunctions: [
      'CharacterFeedbackSchema: Maps mistakes, user corrections, categories, and references.',
      'Compound Index: Integrates rapid lookup keys across bibleId, characterId, and category.'
    ],
    codePreview: `// Mongoose Compound Index for RAG Retrieval
CharacterFeedbackSchema.index({ bibleId: 1, characterId: 1, category: 1 });
export const CharacterFeedback = mongoose.model('CharacterFeedback', CharacterFeedbackSchema);`,
    interrogationDefense: 'Use this file to explain your low-cost alignment logic. Highlight the compound index which speeds up MongoDB search operations to keeping latency near zero.',
    localLink: 'file:///p:/Time%20pass/learn/script-editor-standalone/backend/src/models/CharacterFeedback.ts'
  }
];

export function DocsPage() {
  const [selectedFile, setSelectedFile] = useState<DocFile>(FILES_DOCS[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', 'Backend Core', 'AI & RAG Services', 'Frontend Architecture', 'Databases & Infrastructure'];

  const filteredFiles = FILES_DOCS.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          file.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || file.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div 
      className="min-h-screen font-sans" 
      style={{ 
        background: 'var(--surface-page)', 
        color: 'var(--text-primary)',
        transition: 'background-color 0.2s, color 0.2s'
      }}
    >
      {/* Header Bar */}
      <header 
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{ 
          borderColor: 'var(--border-subtle)',
          background: 'var(--surface-sidebar)'
        }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ background: 'var(--accent)' }}
          />
          <h1 className="text-xs font-black uppercase tracking-[0.25em]">
            Lipi Studio <span style={{ color: 'var(--accent)' }}>//</span> Architecture Explorer
          </h1>
        </div>
        <div className="text-[10px] font-mono tracking-widest text-text-tertiary uppercase">
          V1.0 Architecture Explorer
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-53px)]">
        
        {/* Responsive Sidebar */}
        <aside 
          className="w-full lg:w-[350px] p-6 border-r flex flex-col gap-6"
          style={{ 
            borderColor: 'var(--border-subtle)',
            background: 'var(--surface-sidebar)'
          }}
        >
          {/* Search Inputs */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-tertiary">Search Codebase</label>
            <input 
              type="text" 
              placeholder="Filter by filename or keyword..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded border focus-ring font-mono"
              style={{ 
                background: 'var(--surface-input)', 
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                minHeight: '44px'
              }}
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-tertiary">Filter Categories</label>
            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="px-2 py-1 text-[9px] font-black uppercase tracking-wider rounded border transition-all duration-150 focus-ring"
                  style={{
                    background: activeCategory === cat ? 'var(--accent)' : 'var(--surface-page)',
                    borderColor: activeCategory === cat ? 'var(--accent)' : 'var(--border-subtle)',
                    color: activeCategory === cat ? '#ffffff' : 'var(--text-primary)',
                    minHeight: '44px',
                    paddingLeft: '0.75rem',
                    paddingRight: '0.75rem'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Directory Files List */}
          <div className="flex flex-col gap-2 flex-grow overflow-y-auto max-h-[300px] lg:max-h-[calc(100vh-320px)]">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-text-tertiary">Monorepo Files ({filteredFiles.length})</label>
            <div className="flex flex-col gap-1">
              {filteredFiles.map((file) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFile(file)}
                  className="w-full text-left px-3 py-2 rounded text-xs font-mono transition-all duration-150 flex items-center justify-between border focus-ring"
                  style={{
                    background: selectedFile.name === file.name ? 'var(--accent-soft)' : 'transparent',
                    borderColor: selectedFile.name === file.name ? 'var(--accent)' : 'transparent',
                    color: selectedFile.name === file.name ? 'var(--accent)' : 'var(--text-primary)',
                    minHeight: '44px'
                  }}
                >
                  <span className="truncate">{file.name}</span>
                  <span 
                    className="text-[8px] font-sans font-bold px-1.5 py-0.5 rounded uppercase tracking-wider scale-90"
                    style={{ 
                      background: 'var(--surface-elevated)', 
                      color: 'var(--text-tertiary)' 
                    }}
                  >
                    {file.name.split('.').pop()}
                  </span>
                </button>
              ))}
              {filteredFiles.length === 0 && (
                <p className="text-xs text-text-tertiary font-mono p-4 text-center">No matching files found.</p>
              )}
            </div>
          </div>
        </aside>

        {/* Details View Area */}
        <main className="flex-grow p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-53px)] flex flex-col gap-8">
          
          {/* File Header Panel */}
          <div 
            className="p-6 rounded border flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            style={{ 
              borderColor: 'var(--border-subtle)',
              background: 'var(--surface-elevated)'
            }}
          >
            <div className="flex flex-col gap-1.5">
              <span 
                className="text-[9px] font-black uppercase tracking-[0.2em]"
                style={{ color: 'var(--accent)' }}
              >
                {selectedFile.category}
              </span>
              <h2 className="text-xl font-bold tracking-tight font-mono">{selectedFile.name}</h2>
              <p className="text-xs text-text-tertiary font-mono">{selectedFile.path}</p>
            </div>
            
            {/* Quick Open Anchor */}
            <a
              href={selectedFile.localLink}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start lg:self-center px-4 py-2 text-xs font-black uppercase tracking-widest rounded border transition-all duration-150 focus-ring text-center flex items-center justify-center"
              style={{
                background: 'var(--accent)',
                borderColor: 'var(--accent)',
                color: '#ffffff',
                minHeight: '44px',
                paddingLeft: '1.5rem',
                paddingRight: '1.5rem'
              }}
            >
              Open File in Editor
            </a>
          </div>

          {/* Description Section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-tertiary border-b pb-1" style={{ borderColor: 'var(--border-subtle)' }}>
              Architectural Overview
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {selectedFile.description}
            </p>
          </div>

          {/* Key Capabilities */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-tertiary border-b pb-1" style={{ borderColor: 'var(--border-subtle)' }}>
              Core Operations & Functions
            </h3>
            <ul className="flex flex-col gap-2.5">
              {selectedFile.keyFunctions.map((func, idx) => (
                <li key={idx} className="text-xs leading-normal flex items-start gap-2.5">
                  <span className="font-mono mt-0.5" style={{ color: 'var(--accent)' }}>▶</span>
                  <span style={{ color: 'var(--text-primary)' }}>{func}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Code Inspector */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-tertiary border-b pb-1" style={{ borderColor: 'var(--border-subtle)' }}>
              Code Preview Inspector
            </h3>
            <pre 
              className="p-5 rounded text-xs font-mono overflow-x-auto leading-relaxed border"
              style={{
                background: 'var(--surface-input)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--accent)'
              }}
            >
              <code>{selectedFile.codePreview}</code>
            </pre>
          </div>

          {/* The Interrogator's Defense Section */}
          <div 
            className="p-5 rounded border flex flex-col gap-2"
            style={{
              borderColor: 'var(--accent)',
              background: 'var(--surface-elevated)'
            }}
          >
            <h4 className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: 'var(--accent)' }}>
              🛡️ Interview Defence Strategy
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {selectedFile.interrogationDefense}
            </p>
          </div>

        </main>
      </div>
    </div>
  );
}
