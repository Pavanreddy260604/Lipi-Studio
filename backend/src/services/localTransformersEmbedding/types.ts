export type PendingRequest = {
    resolve: (value: number[]) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};
