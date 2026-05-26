import { baseApi } from './base.api';
import { z } from 'zod';

const metadataSchema = z.record(z.string(), z.unknown()).catch({});

export interface ActivityLog {
    type: 'navigation' | 'click' | 'edit' | 'create' | 'delete' | 'search' | 'command';
    description: string;
    metadata?: any;
    timestamp?: Date;
}

export const activityApi = {
    /**
     * Log a user activity
     */
    async log(activity: ActivityLog): Promise<void> {
        const sanitizedMetadata = activity.metadata ? metadataSchema.parse(activity.metadata) : undefined;
        return baseApi.request<void>('/activity', {
            method: 'POST',
            body: JSON.stringify({ ...activity, metadata: sanitizedMetadata }),
        });
    },

    /**
     * Get recent activity history
     */
    async getHistory(limit: number = 20): Promise<ActivityLog[]> {
        return baseApi.request<ActivityLog[]>(`/activity/history?limit=${limit}`);
    }
};
