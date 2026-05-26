declare module 'mammoth' {
    interface MammothResult {
        value: string; // The generated text
        messages: any[]; // Any messages, such as warnings during conversion
    }

    interface MammothOptions {
        buffer: Buffer;
    }

    export function extractRawText(options: MammothOptions): Promise<MammothResult>;
}
