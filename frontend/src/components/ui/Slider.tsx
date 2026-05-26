
import { cn } from '../../lib/utils';

interface SliderProps {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: number) => void;
    className?: string;
    label?: string;
    suffix?: string;
}

export function Slider({
    value,
    min = 0,
    max = 100,
    step = 1,
    onChange,
    className,
    label,
    suffix
}: SliderProps) {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className={cn("w-full", className)}>
            {(label || suffix) && (
                <div className="flex justify-between mb-2">
                    {label && <label className="text-sm font-medium text-text-primary">{label}</label>}
                    {suffix && <span className="text-sm text-text-secondary">{value}{suffix}</span>}
                </div>
            )}
            <div className="relative w-full h-6 flex items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Track Background */}
                <div className="absolute w-full h-2 bg-console-surface-2 rounded-full overflow-hidden">
                    {/* Active Track */}
                    <div
                        className="h-full bg-accent-primary transition-[width] duration-[120ms] ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                {/* Thumb Handle */}
                <div
                    className="absolute h-5 w-5 bg-[var(--bg-elevated)] border-2 border-accent-primary rounded-full shadow-md transition-[left] duration-[120ms] ease-out pointer-events-none active:scale-110"
                    style={{ left: `calc(${percentage}% - 10px)` }}
                />
            </div>
        </div>
    );
}
