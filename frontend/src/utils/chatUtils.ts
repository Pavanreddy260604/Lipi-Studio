/**
 * Cleans internal progress markers and other metadata from the chat content
 * before rendering it in the UI.
 */
export const cleanContent = (content: string): string => {
    if (!content) return content;
    
    // Remove __PROGRESS__: messages that might have leaked into the final content
    return content.replace(/__PROGRESS__:.*?\n/g, '').replace(/__PROGRESS__:.*?$/, '');
};
