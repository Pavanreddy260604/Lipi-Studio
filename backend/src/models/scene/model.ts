import mongoose from 'mongoose';
import type { IScene } from './schema.js';
import { SceneSchema } from './schema.js';

export const Scene = mongoose.model<IScene>('Scene', SceneSchema);
