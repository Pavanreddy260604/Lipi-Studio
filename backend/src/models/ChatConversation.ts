import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    images?: string[];
    attachmentIds?: string[];
}

export interface IChatConversation {
    _id?: mongoose.Types.ObjectId;
    userId: string;
    title: string;
    model: string;
    assistantType: 'learning-os' | 'script-writer';
    messages: IChatMessage[];
    createdAt?: Date;
    updatedAt?: Date;
}

const chatMessageSchema = new Schema<IChatMessage>({
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    images: [{ type: String, select: false }],
    attachmentIds: [{ type: String }],
}, { _id: false });

const chatConversationSchema = new Schema<IChatConversation>({
    userId: { type: String, required: true, index: true },
    title: { type: String, default: 'New conversation' },
    model: { type: String, default: 'balanced' },
    assistantType: { type: String, enum: ['learning-os', 'script-writer'], default: 'learning-os' },
    messages: {
        type: [chatMessageSchema],
        validate: {
            validator: function (v: IChatMessage[]) {
                return v.length <= 500;
            },
            message: 'Conversation exceeds maximum message count (500)'
        }
    },
}, { timestamps: true });

chatConversationSchema.pre('save', function (next) {
    if (this.messages && this.messages.length > 200) {
        this.messages = this.messages.slice(-200);
    }
    next();
});

chatConversationSchema.index({ userId: 1, updatedAt: -1 });

export const ChatConversation = mongoose.model<IChatConversation>('ChatConversation', chatConversationSchema);
