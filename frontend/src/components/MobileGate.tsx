import { Monitor, Tablet, LogOut, Sparkles } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export function MobileGate() {
    const { logout, user } = useAuthStore();

    return (
        <div
            style={{
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 32px',
                background: 'var(--surface-page)',
                color: 'var(--text-body)',
                boxSizing: 'border-box',
            }}
        >
            {/* Top section — pushed up with flex spacer below */}
            <div style={{ flex: 1 }} />

            {/* Logo */}
            <div
                style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '40px',
                }}
            >
                <Sparkles size={22} style={{ color: 'var(--text-on-accent)' }} />
            </div>

            {/* Heading */}
            <h1
                style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    margin: '0 0 12px 0',
                    textAlign: 'center',
                }}
            >
                Built for Bigger Screens
            </h1>

            {/* Description */}
            <p
                style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    maxWidth: '280px',
                    textAlign: 'center',
                    margin: '0 0 40px 0',
                }}
            >
                Lipi Studio is a professional screenwriting workspace. Please switch to a desktop or tablet.
            </p>

            {/* Device hints */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '32px',
                    marginBottom: '48px',
                    opacity: 0.5,
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)' }}>
                    <Monitor size={28} strokeWidth={1.5} />
                    <span style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Desktop</span>
                </div>
                <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--border-subtle)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)' }}>
                    <Tablet size={28} strokeWidth={1.5} />
                    <span style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tablet</span>
                </div>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1.5 }} />

            {/* User card — anchored toward bottom */}
            <div
                style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--surface-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}
            >
                {user && (
                    <div
                        style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '9999px',
                            backgroundColor: 'var(--accent)',
                            color: 'var(--text-on-accent, #fff)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: 800,
                            flexShrink: 0,
                        }}
                    >
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.name || 'User'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.email || ''}
                    </div>
                </div>
                <button
                    onClick={() => logout()}
                    className="focus-ring"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'color 0.15s, border-color 0.15s',
                    }}
                    title="Sign Out"
                >
                    <LogOut size={15} />
                </button>
            </div>
        </div>
    );
}
