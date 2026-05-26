// ─── Core Data Models — Project CRYSTAL v2.0 ───

export type Language = 'javascript' | 'python' | 'java' | 'cpp' | 'go' | 'sql';

export interface Position {
    line: number;
    column: number;
}

// ─── Interview Models ───

export interface TestCase {
    id: string;
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
}

export interface ExecutionResult {
    testCaseId: string;
    passed: boolean;
    actualOutput: string;
    stdout: string[];
    executionTime: number;
    memoryUsed: number;
    error?: string;
}

export interface InterviewQuestion {
    id: string;
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: string;
    tags: string[];
    starterCode: Record<Language, string> | string; // Support both flat and mapped
    testCases: TestCase[];
    hints?: string[];
    solution?: string;
    timeLimit?: number;
}

export interface InterviewSession {
    id: string;
    questionId: string;
    userId: string;
    startTime: Date;
    endTime?: Date;
    code: Record<Language, string> | string;
    language: Language;
    testResults: ExecutionResult[];
    submitted: boolean;
    cameraEnabled: boolean;
    timerEnabled: boolean;
    timeRemaining?: number;
}

// ─── Flashcard Models ───

export type CardDifficulty = 'easy' | 'medium' | 'hard';

export interface Flashcard {
    id: string;
    deckId: string;
    question: string;
    answer: string;
    tags: string[];
    difficulty: CardDifficulty;
    createdAt: Date;
    updatedAt: Date;
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReviewDate: Date;
}

export interface DeckSettings {
    newCardsPerDay: number;
    maxReviewsPerDay: number;
    easyBonus: number;
    intervalModifier: number;
    maximumInterval: number;
}

export interface FlashcardDeck {
    id: string;
    name: string;
    description: string;
    category: string;
    cardCount: number;
    newCards: number;
    dueCards: number;
    createdAt: Date;
    updatedAt: Date;
    settings: DeckSettings;
}

export interface StudySession {
    id: string;
    deckId: string;
    userId: string;
    startTime: Date;
    endTime?: Date;
    cardsStudied: number;
    cardsRemaining: number;
    ratings: Record<string, number>;
    completed: boolean;
}
