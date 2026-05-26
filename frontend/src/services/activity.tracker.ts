
import { api } from './api';
import type { ActivityLog } from './activity.api';

class ActivityTrackerService {

    log(type: ActivityLog['type'], description: string, metadata?: any) {
        // Only log if we have a token (user is logged in) - api handles this check internally typically, 
        // but here we can check if token is set in api instance
        if (!api.getToken()) return;

        if (import.meta.env.DEV) console.log(`[Activity] ${type}: ${description}`, metadata);

        // Fire and forget
        api.logActivity({ type, description, metadata, timestamp: new Date() })
            .catch(err => console.error('Failed to log activity silently:', err));
    }

    setToken(_token: string | null) {
        // Redundant now as api service manages token centrally, 
        // but kept for API compatibility if needed or removed if unused.
        // The AuthStore already updates the main api instance.
    }

    // Helper for navigation
    logNavigation(path: string) {
        this.log('navigation', `Navigated to ${path}`, { path });
    }

    // Helper for clicks
    logClick(element: string, context?: string) {
        this.log('click', `Clicked ${element}`, { context });
    }
}

export const activityTracker = new ActivityTrackerService();
