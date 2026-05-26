import { useState, useEffect, useRef } from 'react';
import {
    LogOut,
    Download,
    Moon,
    Trash2,
    Save,
    Check,
    Palette,
    Cpu,
    Key,
    Sparkles,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useDialog } from '../hooks/useDialog';
import { AlertDialog } from '../components/ui/AlertDialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Page, Stack, Grid, Card, Input, Button } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useUIStore } from '../stores/uiStore';
import { ACCENT_COLORS } from '../config/accents';
import { api } from '../services/api';
import { scriptWriterApi } from '../services/scriptWriter.api';

export function Settings() {
    const { user, logout, checkAuth } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const { 
        accentColor, setAccentColor, 
        customAccentColor, setCustomAccentColor,
    } = useUIStore();
    const { dialog, showAlert, showConfirm, closeDialog } = useDialog();

    const colorInputRef = useRef<HTMLInputElement>(null);

    // Profile Identity States
    const [profileName, setProfileName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

    // AI Workspace States
    const [aiProvider, setAiProvider] = useState<string>('gemini');
    const [isSavingProvider, setIsSavingProvider] = useState(false);
    const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
    const [isSavingKey, setIsSavingKey] = useState(false);
    const [keySaveSuccess, setKeySaveSuccess] = useState(false);

    useEffect(() => {
        document.title = 'Settings — Lipi Studio';
        return () => { document.title = 'Lipi Studio'; };
    }, []);

    useEffect(() => {
        if (user) {
            setProfileName(user.name || '');
            setProfileEmail(user.email || '');
        }
    }, [user]);

    useEffect(() => {
        const loadAIProvider = async () => {
            try {
                const provider = await scriptWriterApi.getAIProvider();
                setAiProvider(provider || 'gemini');
            } catch (error) {
                console.error('Failed to fetch AI provider', error);
            }
        };
        loadAIProvider();
    }, []);

    const handleSwitchProvider = async (provider: string) => {
        setIsSavingProvider(true);
        try {
            const newProvider = await scriptWriterApi.setAIProvider(provider);
            setAiProvider(newProvider);
            showAlert('Success', `AI Service switched to ${newProvider.toUpperCase()} successfully.`);
        } catch (error: any) {
            console.error('Failed to switch AI provider', error);
            showAlert('Switch Failed', error.message || 'Failed to switch provider.');
        } finally {
            setIsSavingProvider(false);
        }
    };

    const handleSaveAIKey = async () => {
        const trimmedKey = geminiApiKeyInput.trim();
        if (!trimmedKey) {
            showAlert('Validation Error', 'API Key cannot be empty.');
            return;
        }
        setIsSavingKey(true);
        setKeySaveSuccess(false);
        try {
            await api.updateAIKey(trimmedKey);
            setKeySaveSuccess(true);
            await checkAuth(); // Refresh user session to reflect `hasApiKey`
            setGeminiApiKeyInput('');
            showAlert('Success', 'Gemini API Key updated securely.');
            setTimeout(() => setKeySaveSuccess(false), 3000);
        } catch (error: any) {
            console.error('Failed to update API key', error);
            showAlert('Update Failed', error.message || 'Failed to update API key.');
        } finally {
            setIsSavingKey(false);
        }
    };

    const handleSaveProfile = async () => {
        const trimmedName = profileName.trim();
        const trimmedEmail = profileEmail.trim().toLowerCase();

        if (!trimmedName) {
            showAlert('Validation Error', 'Identity Tag (Name) cannot be empty.');
            return;
        }

        if (!trimmedEmail) {
            showAlert('Validation Error', 'Network Address (Email) cannot be empty.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            showAlert('Validation Error', 'Please enter a valid email address.');
            return;
        }

        setIsSavingProfile(true);
        setProfileSaveSuccess(false);

        try {
            const response = await api.updateProfile({
                name: trimmedName,
                email: trimmedEmail,
            });

            await checkAuth();
            setProfileSaveSuccess(true);
            
            if (response.emailChanged) {
                showAlert(
                    'Verification Required',
                    'Your email address has been updated. A new 6-digit verification code has been sent. Screenplay services are locked until you verify your new email.'
                );
            } else {
                showAlert('Success', 'Profile updated successfully.');
            }

            setTimeout(() => setProfileSaveSuccess(false), 3000);
        } catch (error: any) {
            console.error('Failed to update profile details', error);
            showAlert('Update Failed', error.message || 'Failed to update profile. Please try again.');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleLogout = () => {
        showConfirm(
            'Confirm Logout',
            'Are you sure you want to log out of the screenplay workspace?',
            logout
        );
    };

    const handleDeleteAccount = async () => {
        showConfirm(
            'Purge Creative Workspace',
            'Are you ABSOLUTELY SURE? This will permanently delete your account, API configurations, and all screenplays. This action cannot be undone.',
            async () => {
                try {
                    await api.deleteAccount();
                    logout();
                } catch (error) {
                    console.error('Failed to delete account', error);
                    showAlert('Error', 'Failed to purge account.');
                }
            }
        );
    };

    return (
        <Page
            kicker="System Preferences"
            title={<>Command <span className="text-accent">Center</span></>}
            subtitle="Lipi Studio // v1.1.0 Premium Standalone"
            className="max-w-4xl mx-auto"
        >
            <Grid cols={1} gap={8} className="lg:grid-cols-2">
                {/* Profile Card */}
                <Card className="p-8 sm:p-10 shadow-lg bg-subtle-2 h-full">
                    <Stack gap={6}>
                        <div className="flex items-center justify-between">
                            <Stack direction="horizontal" gap={3} align="center">
                                <div className="p-2 rounded-xl bg-accent/10 text-accent">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black bg-accent/10 text-accent">
                                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                </div>
                                <h2 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Identity Profile</h2>
                            </Stack>
                            <Button
                                onClick={handleSaveProfile}
                                disabled={isSavingProfile}
                                isLoading={isSavingProfile}
                                variant={profileSaveSuccess ? 'primary' : 'secondary'}
                                size="sm"
                                className="h-9 px-4 focus-ring"
                            >
                                {profileSaveSuccess ? <Check size={14} /> : <Save size={14} />}
                            </Button>
                        </div>

                        <Stack gap={4}>
                            <Stack gap={2}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Identity Tag</label>
                                <Input 
                                    value={profileName} 
                                    onChange={(e) => setProfileName(e.target.value)}
                                    placeholder="Enter your name..."
                                    className="focus-ring"
                                />
                            </Stack>
                            <Stack gap={2}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Network Address</label>
                                <Input 
                                    value={profileEmail} 
                                    onChange={(e) => setProfileEmail(e.target.value)}
                                    placeholder="Enter your email address..."
                                    className="focus-ring"
                                    type="email"
                                />
                            </Stack>

                            {profileEmail.trim().toLowerCase() !== user?.email?.toLowerCase() && (
                                <div className="p-4 rounded-xl border border-subtle-10 bg-subtle-3 text-[11px] text-status-warning leading-relaxed flex flex-col gap-1">
                                    <span className="font-black uppercase tracking-wider text-[9px] text-status-warning flex items-center gap-1.5">
                                        ⚠️ Re-Verification Warning
                                    </span>
                                    <span>
                                        Updating your email will reset your verification status. All screenplay services will be temporarily suspended until the new email is verified.
                                    </span>
                                </div>
                            )}

                            {!user?.emailVerified && (
                                <div className="p-4 rounded-xl border border-status-error/20 bg-status-error/5 text-[11px] text-status-error leading-relaxed flex flex-col gap-1">
                                    <span className="font-black uppercase tracking-wider text-[9px] text-status-error flex items-center gap-1.5">
                                        ⚠️ Unverified Status
                                    </span>
                                    <span>
                                        Your email address is unverified. Access to screenplay generation, scene bibles, and intelligence tools is locked until verified.
                                    </span>
                                </div>
                            )}
                        </Stack>
                    </Stack>
                </Card>

                {/* Design Palette Preferences */}
                <Card className="p-8 sm:p-10 shadow-lg bg-subtle-2 h-full">
                    <Stack gap={6}>
                        <Stack direction="horizontal" gap={3} align="center">
                            <div className="p-2 rounded-xl bg-accent/10 text-accent">
                                <Palette size={18} />
                            </div>
                            <h2 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Appearance</h2>
                        </Stack>

                        <Stack gap={6}>
                            <Grid cols={1} gap={3}>
                                <button
                                    onClick={toggleTheme}
                                    className={cn(
                                        "flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all focus-ring",
                                        theme === 'dark' ? "bg-subtle-3 border-accent/30 text-accent" : "bg-subtle-3 border-subtle-8 text-muted"
                                    )}
                                >
                                    <Moon size={20} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                                </button>
                            </Grid>

                            <Stack gap={4}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Accent Identity</label>
                                <Grid cols={7} gap={2}>
                                    {Object.values(ACCENT_COLORS).map((color) => (
                                        <button
                                            key={color.id}
                                            onClick={() => setAccentColor(color.id)}
                                            className={cn(
                                                "w-full aspect-square rounded-xl border-2 transition-all flex items-center justify-center relative group focus-ring",
                                                accentColor === color.id ? "border-[var(--text-heading)] scale-110 shadow-lg" : "border-transparent hover:brightness-110"
                                            )}
                                            style={{ backgroundColor: color.hex }}
                                            title={color.name}
                                        >
                                            {accentColor === color.id && <Check size={14} className="text-white drop-shadow-md" />}
                                            <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </Grid>
                                
                                <Stack direction="horizontal" gap={2}>
                                    <div className="relative flex-1 group">
                                        <div 
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg border-2 border-subtle-20 shadow-sm cursor-pointer transition-all hover:scale-110 active:scale-95 z-10"
                                            style={{ backgroundColor: customAccentColor || 'var(--accent)' }}
                                            onClick={() => colorInputRef.current?.click()}
                                        >
                                            <div className="absolute inset-0 rounded-lg bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <Input
                                            placeholder="#HEX CODE"
                                            value={customAccentColor || ''}
                                            onChange={(e) => {
                                                let val = e.target.value.toUpperCase();
                                                if (val && !val.startsWith('#')) val = '#' + val;
                                                setCustomAccentColor(val.substring(0, 7));
                                            }}
                                            className="w-full font-mono text-xs uppercase pl-12 h-12 bg-subtle-3 border-subtle-8 focus:border-accent/40 transition-all focus-ring"
                                        />
                                        <input 
                                            ref={colorInputRef}
                                            type="color"
                                            className="sr-only"
                                            value={(customAccentColor?.startsWith('#') && customAccentColor.length === 7) ? customAccentColor : '#EB644B'}
                                            onChange={(e) => setCustomAccentColor(e.target.value.toUpperCase())}
                                        />
                                    </div>
                                </Stack>
                            </Stack>
                        </Stack>
                    </Stack>
                </Card>

                {/* AI Intelligence Workspace Card */}
                <Card className="p-8 sm:p-10 shadow-lg bg-subtle-2 h-full lg:col-span-2">
                    <Stack gap={6}>
                        <Stack direction="horizontal" gap={3} align="center">
                            <div className="p-2 rounded-xl bg-accent/10 text-accent">
                                <Cpu size={18} />
                            </div>
                            <h2 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">AI Intelligence Workspace</h2>
                        </Stack>

                        <Grid cols={1} gap={6} className="md:grid-cols-2">
                            {/* Provider Switching */}
                            <Stack gap={4}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">AI Provider Engine</label>
                                <div className="flex flex-col gap-2">
                                    {[
                                        { id: 'gemini', name: 'Google Gemini', desc: 'Default Advanced Model Workspace' },
                                        { id: 'ollama', name: 'Ollama (Local)', desc: 'Run locally via active Ollama server' },
                                        { id: 'mistral', name: 'Mistral (Cloud)', desc: 'Enterprise-grade open weight synthesis' }
                                    ].map((prov) => (
                                        <button
                                            key={prov.id}
                                            disabled={isSavingProvider}
                                            onClick={() => handleSwitchProvider(prov.id)}
                                            className={cn(
                                                "flex flex-col items-start gap-1 p-4 rounded-xl border text-left transition-all focus-ring cursor-pointer",
                                                aiProvider === prov.id 
                                                    ? "bg-subtle-3 border-accent/40 text-accent" 
                                                    : "bg-subtle-3 border-subtle-8 hover:border-subtle-20 text-muted"
                                            )}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span className="text-[10px] font-black uppercase tracking-widest">{prov.name}</span>
                                                {aiProvider === prov.id && (
                                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-accent/15 text-accent tracking-wider">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] opacity-60 leading-relaxed">{prov.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </Stack>

                            {/* Private Encrypted API Key */}
                            <Stack gap={4} className="justify-between">
                                <Stack gap={4}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Gemini Workspace Credentials</label>
                                        {user?.hasApiKey ? (
                                            <span className="text-[9px] font-black uppercase tracking-wider text-status-success flex items-center gap-1">
                                                <Check size={12} /> Key Secured
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-black uppercase tracking-wider text-muted">
                                                No key configured
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                            <Key size={16} />
                                        </div>
                                        <Input
                                            type="password"
                                            placeholder={user?.hasApiKey ? "••••••••••••••••••••••••••••••••" : "Paste your Gemini API Key..."}
                                            value={geminiApiKeyInput}
                                            onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                                            className="w-full pl-10 focus-ring"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted opacity-60 leading-relaxed">
                                        Your API key is encrypted using AES-256-GCM prior to database persistence. Lipi Studio Standalone relies on this credential for local scene generation and character casting queries.
                                    </p>
                                </Stack>

                                <div className="flex justify-end pt-4">
                                    <Button
                                        onClick={handleSaveAIKey}
                                        disabled={isSavingKey}
                                        isLoading={isSavingKey}
                                        variant={keySaveSuccess ? 'primary' : 'secondary'}
                                        className="h-10 px-6 focus-ring"
                                    >
                                        {keySaveSuccess ? (
                                            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                                                <Check size={14} /> Saved & Verified
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                                                <Save size={14} /> Update API Credentials
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </Stack>
                        </Grid>
                    </Stack>
                </Card>

                {/* Workspace Management */}
                <Card className="p-8 sm:p-10 shadow-lg bg-subtle-2 lg:col-span-2">
                    <Stack gap={6}>
                        <Stack direction="horizontal" gap={3} align="center">
                            <div className="p-2 rounded-xl bg-status-info/10 text-status-info">
                                <Download size={18} />
                            </div>
                            <h2 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Workspace Options</h2>
                        </Stack>

                        <Grid cols={1} gap={3} className="sm:grid-cols-2">
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-4 p-4 rounded-2xl bg-subtle-3 border border-subtle-8 hover:border-accent/20 transition-all text-left cursor-pointer"
                            >
                                <LogOut size={18} className="text-muted" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Sign Out of Workspace</span>
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                className="flex items-center gap-4 p-4 rounded-2xl bg-status-error/5 border border-status-error/20 hover:bg-status-error/10 transition-all text-left cursor-pointer"
                            >
                                <Trash2 size={18} className="text-status-error" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-status-error">Purge Screenplay Database</span>
                            </button>
                        </Grid>
                    </Stack>
                </Card>
            </Grid>

            <footer className="pt-16 text-center opacity-20">
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-muted">
                    Lipi Studio // Control Panel // Standalone SaaS v1.1.0
                </p>
            </footer>

            <AlertDialog
                isOpen={dialog.isOpen && dialog.type === 'alert'}
                onClose={closeDialog}
                title={dialog.title}
                description={dialog.description}
            />

            <ConfirmDialog
                isOpen={dialog.isOpen && dialog.type === 'confirm'}
                onClose={closeDialog}
                onConfirm={dialog.onConfirm || (() => { })}
                title={dialog.title}
                description={dialog.description}
                variant={dialog.title.includes('Delete') || dialog.title.includes('Purge') ? 'danger' : 'primary'}
            />
        </Page>
    );
}
