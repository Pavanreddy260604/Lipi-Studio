import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, PanelLeftClose } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SidebarItem } from './SidebarItem';
import type { ChatConversation } from '../../../services/api';

interface ChatSidebarProps {
    sidebarOpen: boolean;
    isMobile: boolean;
    isTablet: boolean;
    conversations: ChatConversation[];
    conversationId: string | null;
    memoizedGroups: [string, ChatConversation[]][];
    renameTargetId: string | null;
    deleteTargetId: string | null;
    newTitle: string;
    setNewTitle: (title: string) => void;
    setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    handleNewChat: () => void;
    setConversationId: (id: string | null) => void;
    handleRenameInit: (e: React.MouseEvent, id: string, title: string) => void;
    confirmRename: () => void;
    confirmDelete: (e?: React.MouseEvent) => void;
    handleDelete: (e: React.MouseEvent, id: string) => void;
    setRenameTargetId: (id: string | null) => void;
    setDeleteTargetId: (id: string | null) => void;
}

export const ChatSidebar = ({
    sidebarOpen,
    isMobile,
    isTablet,
    conversations,
    conversationId,
    memoizedGroups,
    renameTargetId,
    deleteTargetId,
    newTitle,
    setNewTitle,
    setSidebarOpen,
    handleNewChat,
    setConversationId,
    handleRenameInit,
    confirmRename,
    confirmDelete,
    handleDelete,
    setRenameTargetId,
    setDeleteTargetId
}: ChatSidebarProps) => {
    useEffect(() => {
        if (isMobile && sidebarOpen) {
            const original = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = original; };
        }
    }, [isMobile, sidebarOpen]);

    return (
        <>
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/40 z-[90] lg:hidden"
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={false}
                animate={{ 
                    x: sidebarOpen ? 0 : -320,
                    opacity: sidebarOpen ? 1 : 0 
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={cn(
                    "fixed top-0 left-0 bottom-0 z-[100] h-dvh bg-surface-elevated border-r border-subtle-8 shadow-2xl transition-opacity",
                    isMobile ? "w-[280px]" : isTablet ? "w-[240px]" : "w-[300px]",
                    !sidebarOpen && "pointer-events-none"
                )}
            >
                <div className="h-full flex flex-col overflow-hidden">
                    <div className="p-3 pt-5 flex items-center gap-2">
                        <button
                            onClick={handleNewChat}
                            className="flex-1 bg-accent text-on-accent flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold rounded-xl focus-ring hover:opacity-90 transition-colors"
                        >
                            <Plus size={16} />
                            <span className="flex-1 text-left">New chat</span>
                        </button>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-2.5 hover:bg-subtle-10 rounded-xl text-text-tertiary transition-colors"
                            title="Close sidebar"
                        >
                            <PanelLeftClose size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-4 custom-scrollbar">
                        {memoizedGroups.map(([groupName, groupConversationList]) => (
                            <div key={groupName} className="mb-4 last:mb-2">
                                <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-3 mb-2 mt-4 first:mt-1 select-none">
                                    {groupName}
                                </div>
                                <div className="flex flex-col gap-1">
                                    {groupConversationList.map(conversation => (
                                        <SidebarItem
                                            key={conversation._id}
                                            conversation={conversation}
                                            isActive={conversationId === conversation._id}
                                            renameTargetId={renameTargetId}
                                            deleteTargetId={deleteTargetId}
                                            newTitle={newTitle}
                                            setNewTitle={setNewTitle}
                                            onSelect={(id: string) => {
                                                setConversationId(id);
                                                if (isMobile) setSidebarOpen(false);
                                            }}
                                            onRenameInit={handleRenameInit}
                                            onRenameConfirm={confirmRename}
                                            onRenameCancel={() => setRenameTargetId(null)}
                                            onDeleteInit={handleDelete}
                                            onDeleteConfirm={confirmDelete}
                                            onDeleteCancel={() => setDeleteTargetId(null)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </>
    );
};
