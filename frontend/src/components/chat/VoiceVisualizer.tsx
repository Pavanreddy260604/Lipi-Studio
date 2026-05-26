import { motion } from 'framer-motion';

interface VoiceVisualizerProps {
    volume: number; // 0 to 100
    isSpeaking: boolean;
    isListening: boolean;
}

export function VoiceVisualizer({ volume, isSpeaking, isListening }: VoiceVisualizerProps) {
    // Generate 12 bars for a richer visual
    const bars = [0.8, 1.2, 1.8, 2.4, 3.2, 3.8, 3.8, 3.2, 2.4, 1.8, 1.2, 0.8];
    const isActive = isSpeaking || isListening;

    return (
        <div className="flex items-end justify-center gap-1.5 h-32 px-6">
            {bars.map((baseScale, i) => (
                <motion.div
                    key={i}
                    initial={{ height: "4px", opacity: 0.3 }}
                    animate={{
                        height: isActive 
                            ? [
                                `${baseScale * 10}px`, 
                                `${baseScale * (10 + (volume / 3))}px`, 
                                `${baseScale * 10}px`
                              ]
                            : "4px",
                        opacity: isActive ? 1 : 0.3,
                        backgroundColor: "var(--accent-primary)",
                        boxShadow: isActive 
                            ? "0 0 20px rgba(var(--accent-primary-rgb), 0.4)"
                            : "none"
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 0.6 + (i * 0.05),
                        ease: "easeInOut",
                    }}
                    className="w-2 rounded-full"
                />
            ))}
        </div>
    );
}

