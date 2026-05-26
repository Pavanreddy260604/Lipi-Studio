import { ListTree, AlignLeft, User, MessageSquare, Type, ArrowRightLeft, type LucideIcon } from 'lucide-react';

export type ScreenplayMode = 'slug' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition';

export const LANGUAGES = [
    { code: '', label: 'Default' },
    { code: 'te', label: 'తెలుగు (Telugu)' },
    { code: 'hi', label: 'हिन्दी (Hindi)' },
    { code: 'ta', label: 'தமிழ் (Tamil)' },
    { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ml', label: 'മലയാളം (Malayalam)' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
];

export const MODE_CONFIG: Record<ScreenplayMode, { label: string; icon: LucideIcon; indent: number; uppercase?: boolean }> = {
  slug: { label: 'Scene Heading', icon: ListTree, indent: 0, uppercase: true },
  action: { label: 'Action', icon: AlignLeft, indent: 0 },
  character: { label: 'Character', icon: User, indent: 22, uppercase: true },
  dialogue: { label: 'Dialogue', icon: MessageSquare, indent: 10 },
  parenthetical: { label: 'Parenthetical', icon: Type, indent: 16 },
  transition: { label: 'Transition', icon: ArrowRightLeft, indent: 40, uppercase: true },
};

export const MODE_ORDER: ScreenplayMode[] = ['slug', 'action', 'character', 'dialogue', 'parenthetical', 'transition'];

export const ENTER_TRANSITIONS: Record<ScreenplayMode, ScreenplayMode> = {
  slug: 'action',
  action: 'action',
  character: 'dialogue',
  dialogue: 'action',
  parenthetical: 'dialogue',
  transition: 'slug',
};

export const TAB_TRANSITIONS: Record<ScreenplayMode, ScreenplayMode> = {
  slug: 'action',
  action: 'character',
  character: 'dialogue',
  dialogue: 'parenthetical',
  parenthetical: 'dialogue',
  transition: 'slug',
};

export const MODE_SHORTCUT: Record<string, ScreenplayMode> = {
  '1': 'slug',
  '2': 'action',
  '3': 'character',
  '4': 'parenthetical',
  '5': 'dialogue',
  '6': 'transition',
};
