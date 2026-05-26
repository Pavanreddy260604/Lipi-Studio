import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    ZAxis,
    CartesianGrid,
    Tooltip,
    BarChart,
    Bar,
    ScatterChart,
    Scatter,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis
} from 'recharts';
import { 
    Bot, Zap, Cloud, BarChart2, PieChart as PieIcon, TrendingUp, Activity,
    ShieldCheck, CheckCircle2, Circle, Loader2, Cpu, Sparkles, FileText, Search, Compass
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AI_MODELS } from '../../config/aiModels';
import { 
    normalizeTables, 
    getCodeId, 
    getProviderIcon, 
    extractSources, 
    cleanContent, 
    extractProgress,
    robustParseJSON,
    normalizeChartConfig,
    extractRepoCardData
} from './ChatUtils';

const CHART_COLORS = [
    '#6366f1',
    '#a855f7',
    '#ec4899',
    '#3b82f6',
    '#10b981',
    '#f59e0b'
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div 
                className="p-3 rounded-lg shadow-xl animate-scale-in"
                style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
            >
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-1.5">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                    <p className="text-sm font-bold text-[var(--text-heading)]">
                        {payload[0].value.toLocaleString()}
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

const DynamicChart = ({ config }: { config: any }) => {
    const title = config.title || 'Data Visualization';
    const type = config.type || 'bar';
    const data = config.data || [];
    const xAxisKey = config.xAxisKey || 'label';
    const dataKey = config.dataKey || 'value';

    const renderChart = () => {
        const commonProps = {
            data,
            margin: { top: 20, right: 30, left: 0, bottom: 10 }
        };

        const animationProps = {
            isAnimationActive: false
        };

        const t = type?.toLowerCase() || '';

        if (t.includes('pie')) {
            return (
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey={dataKey}
                        stroke="none"
                        {...animationProps}
                    >
                        {data.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            );
        } else if (t.includes('line')) {
            return (
                <LineChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} stroke="var(--text-tertiary)" />
                    <XAxis dataKey={xAxisKey} fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontWeight: 600 }} dy={10} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontWeight: 600 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-subtle)', strokeWidth: 1 }} />
                    <Line type="monotone" dataKey={dataKey} stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} {...animationProps} />
                </LineChart>
            );
        } else if (t.includes('scatter')) {
            const normalizedScatterData = data.map((item: any) => ({
                ...item,
                [dataKey]: Array.isArray(item[dataKey]) ? item[dataKey].length : Number(item[dataKey])
            }));
            return (
                <ScatterChart {...commonProps} data={normalizedScatterData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.05} stroke="var(--text-primary)" />
                    <XAxis dataKey={xAxisKey} name={xAxisKey} fontSize={10} tick={{ fill: 'var(--text-tertiary)' }} type="category" />
                    <YAxis dataKey={dataKey} name={dataKey} fontSize={10} tick={{ fill: 'var(--text-tertiary)' }} />
                    <ZAxis range={[60, 400]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name={title} fill="#8b5cf6" {...animationProps} />
                </ScatterChart>
            );
        } else if (t.includes('radar')) {
            return (
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data} {...animationProps}>
                    <PolarGrid stroke="var(--border-subtle)" opacity={0.3} />
                    <PolarAngleAxis dataKey={xAxisKey} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 8 }} stroke="var(--border-subtle)" />
                    <Radar name={title} dataKey={dataKey} stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} {...animationProps} />
                    <Tooltip content={<CustomTooltip />} />
                </RadarChart>
            );
        } else if (t.includes('area')) {
            return (
                <AreaChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} stroke="var(--text-tertiary)" />
                    <XAxis dataKey={xAxisKey} fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontWeight: 600 }} dy={10} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontWeight: 600 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey={dataKey} stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" fillOpacity={0.1} {...animationProps} />
                </AreaChart>
            );
        } else {
            return (
                <BarChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} stroke="var(--text-tertiary)" />
                    <XAxis dataKey={xAxisKey} fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontWeight: 600 }} dy={10} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontWeight: 600 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-hover)', radius: 4 }} />
                    <Bar dataKey={dataKey} fill="var(--accent)" radius={[4, 4, 0, 0]} {...animationProps} />
                </BarChart>
            );
        }
    };

    const getIcon = () => {
        const t = type?.toLowerCase() || '';
        if (t.includes('pie')) return <PieIcon size={14} />;
        if (t.includes('line')) return <Activity size={14} />;
        if (t.includes('area')) return <TrendingUp size={14} />;
        if (t.includes('scatter')) return <Zap size={14} />;
        if (t.includes('radar')) return <Activity size={14} />;
        return <BarChart2 size={14} />;
    };

    return (
        <div 
            className="my-6 p-4 sm:p-6 rounded-xl transition-all duration-300 group/chart"
            style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
        >
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-subtle-5 text-[var(--accent)] transition-transform duration-300">
                        {getIcon()}
                    </div>
                    <div>
                        <h4 className="text-[10px] sm:text-[12px] font-bold uppercase tracking-widest text-[var(--text-heading)] mb-0.5 truncate max-w-[180px] sm:max-w-none">{title || 'Data Visualization'}</h4>
                        <p className="text-[8px] sm:text-[9px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.15em] opacity-60 hidden sm:block">Contextual Analysis Layer</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-[var(--border-subtle)] bg-subtle-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-ok)] opacity-80" />
                    <span className="text-[8px] font-bold uppercase tracking-tighter text-[var(--text-tertiary)]">Live Stream</span>
                </div>
            </div>
            
            <div className="h-[180px] sm:h-[280px] w-full min-h-[180px] sm:min-h-[280px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>

            {type === 'pie' && (
                <div className="flex flex-wrap justify-center gap-4 mt-6 pt-6 border-t border-[var(--border-subtle)]">
                    {data.map((item: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 group/legend cursor-default">
                            <div className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold uppercase tracking-tight text-[var(--text-secondary)] truncate max-w-[80px]">{item[xAxisKey]}</span>
                                <span className="text-[8px] font-medium text-[var(--text-tertiary)] opacity-60">{item[dataKey].toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const RepoCard = ({ data }: { data: any }) => {
    if (!data) return null;
    return (
        <div 
            className="my-6 p-6 rounded-xl relative group overflow-hidden"
            style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
        >
            <div className="flex items-start justify-between mb-8 relative">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-subtle-5 text-[var(--accent)]">
                        <Bot size={24} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-heading)] truncate max-w-[150px] sm:max-w-[300px]">
                            {data.repo || 'Repository'}
                        </h3>
                        <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest mt-1">
                            {data.owner || 'GitHub'} • {data.defaultBranch || 'main'}
                        </p>
                    </div>
                </div>
                <div className="hidden xs:block px-3 py-1 rounded-md border border-[var(--border-subtle)] bg-subtle-2 text-[var(--text-secondary)] text-[9px] font-bold uppercase tracking-widest">
                    Verified Repo
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8 relative">
                {[
                    { label: 'Files', value: data.fileCount || 0 },
                    { label: 'Nodes', value: data.structureSize || 0 },
                    { label: 'Status', value: data.analysisDepth || 'Audit Complete' }
                ].map((stat, i) => (
                    <div key={i} className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-overlay)] text-center">
                        <div className="text-sm font-bold text-[var(--text-heading)] tracking-tight">{stat.value}</div>
                        <div className="text-[8px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-5 border-t border-[var(--border-subtle)] relative">
                <div className="flex gap-2">
                    {(data.tags || ['Research', 'Analysis', 'Logic']).map((tag: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-subtle-5 text-[var(--text-secondary)] text-[8px] font-bold uppercase tracking-widest">
                            {tag}
                        </span>
                    ))}
                </div>
                <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">
                    Architectural Audit
                </span>
            </div>
        </div>
    );
};

const ToolProgressStatus = ({ progress }: { progress: string[] }) => {
    if (progress.length === 0) return null;

    const lastStep = progress[progress.length - 1];
    const parts = lastStep.split(':');
    const tool = parts[1] || 'SYSTEM';
    const action = parts[2] || parts[1] || 'Processing...';

    const getToolIcon = (t: string) => {
        switch (t.toUpperCase()) {
            case 'SEARCHING': return <Search size={14} />;
            case 'ANALYZING': return <Activity size={14} />;
            case 'FETCHING': return <Compass size={14} />;
            case 'SCRAPING': return <Cloud size={14} />;
            default: return <Cpu size={14} />;
        }
    };

    const getToolLabel = (t: string) => {
        switch (t.toUpperCase()) {
            case 'SEARCHING': return 'Knowledge Discovery';
            case 'ANALYZING': return 'Intelligence Engine';
            case 'FETCHING': return 'Repository Deep-Dive';
            case 'SCRAPING': return 'Web Intelligence';
            default: return 'Architectural Audit';
        }
    };

    return (
        <div 
            className="my-6 p-4 rounded-xl relative overflow-hidden"
            style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
        >
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent)] opacity-60" />
            
            <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-subtle-5 text-[var(--accent)] border border-accent/10">
                            {getToolIcon(tool)}
                        </div>
                        <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-heading)]">{getToolLabel(tool)}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-widest opacity-80">Active Pipeline</span>
                                <div className="w-1 h-1 rounded-full bg-[var(--border-subtle)]" />
                                <span className="text-[9px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest">{tool}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-md border border-[var(--border-subtle)] bg-subtle-2">
                        <Loader2 size={10} className="text-[var(--accent)] animate-spin" />
                        <span className="text-[9px] font-bold uppercase tracking-tighter text-[var(--text-tertiary)]">Real-time</span>
                    </div>
                </div>

                <div className="flex flex-col gap-4 relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border-subtle)]" />

                    {progress.slice(-3).map((step, idx) => {
                        const isLast = idx === Math.min(progress.length, 3) - 1;
                        const displayMsg = step.split(':').pop() || step;
                        
                        return (
                            <div key={idx} className={cn(
                                "flex items-center gap-4 transition-all duration-300 relative pl-1",
                                !isLast ? "opacity-30 scale-95 origin-left" : "opacity-100 scale-100"
                            )}>
                                <div className={cn(
                                    "w-3.5 h-3.5 rounded-full flex items-center justify-center border z-10",
                                    isLast ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-[var(--surface-page)] border-[var(--border-subtle)]"
                                )}>
                                    {isLast ? (
                                        <div className="w-1.5 h-1.5 bg-[var(--text-on-accent)] rounded-full" />
                                    ) : (
                                        <CheckCircle2 size={8} className="text-[var(--text-tertiary)]" />
                                    )}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-bold tracking-widest uppercase",
                                    isLast ? "text-[var(--text-heading)]" : "text-[var(--text-tertiary)]"
                                )}>
                                    {displayMsg}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Cpu size={12} className="text-[var(--text-tertiary)] opacity-40" />
                        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest opacity-40">Contextual Logic Engine V4</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AIChatRenderer = memo(({
    content,
    isLoading,
    isLast,
    handleCopyCode,
    copiedBlockId,
    modelUsed
}: {
    content: string,
    isLoading?: boolean,
    isLast?: boolean,
    handleCopyCode?: (code: string, id: string) => void,
    copiedBlockId?: string | null,
    modelUsed?: string
}) => {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const syntaxTheme = isDark ? vscDarkPlus : vs;

    const sources = useMemo(() => extractSources(content), [content]);
    const progress = useMemo(() => extractProgress(content), [content]);
    const repoCardData = useMemo(() => extractRepoCardData(content), [content]);

    const healedContent = useMemo(() => {
        if (!content) return content;
        let processed = content;

        processed = processed.replace(
            /<?\/?function[^>]*>?\s*(?:function=)?(?:renderChart)?\s*>?\s*(\{[\s\S]*?\})\s*(?:<\/function>)?/gi,
            (_match, json) => {
                try {
                    const parsed = JSON.parse(json);
                    if (parsed.type && (parsed.data || parsed.slices)) {
                        return `\n\`\`\`chart\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n`;
                    }
                } catch { /* invalid JSON, fall through */ }
                return `\n\`\`\`chart\n${json}\n\`\`\`\n`;
            }
        );

        processed = processed.replace(/<\/?function[^>]*>/gi, '');

        processed = processed.replace(
            /(?:^|\n)\s*(\{"(?:type)"\s*:\s*"(?:pie|bar|line|area|scatter|radar)"[\s\S]*?\})\s*(?:\n|$)/g,
            (_match, json) => {
                const idx = processed.indexOf(json);
                const before = processed.substring(Math.max(0, idx - 30), idx);
                if (/```(?:chart|json)\s*$/.test(before)) {
                    return _match;
                }
                return `\n\`\`\`chart\n${json}\n\`\`\`\n`;
            }
        );

        return processed;
    }, [content]);

    return (
        <div className="flex flex-col gap-4 px-4 py-3 sm:px-6 sm:py-4">
            {isLast && isLoading && progress.length > 0 && (
                <ToolProgressStatus progress={progress} />
            )}
            {repoCardData && <RepoCard data={repoCardData} />}
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        if (!inline && match) {
                            const match1 = match[1];
                            const isChartLikeJson = match1 === 'chart' || (
                                (match1 === 'json' || match1 === 'javascript' || match1 === 'typescript') &&
                                /"(pieChart|barChart|lineChart|areaChart|type|data|slices|xAxisKey|dataKey)"\s*:/i.test(codeString)
                            );
                            if (isChartLikeJson) {
                                try {
                                    if (isLoading) {
                                        return (
                                            <div 
                                                className="my-6 p-8 rounded-xl flex flex-col items-center justify-center gap-6"
                                                style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
                                            >
                                                <div className="p-4 rounded-lg bg-subtle-5 text-[var(--accent)]">
                                                    <BarChart2 size={32} className="animate-pulse" />
                                                </div>
                                                <div className="flex flex-col gap-4 text-center">
                                                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-[var(--accent)]">Synthesizing Visuals</h4>
                                                    <p className="text-[9px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest opacity-60">Architecting Data Patterns...</p>
                                                </div>
                                                <div className="w-full max-w-[240px] h-1 bg-subtle-10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-[var(--accent)] w-1/3 rounded-full animate-pulse" />
                                                </div>
                                            </div>
                                        );
                                    }

                                    const parsed = robustParseJSON(codeString);
                                    const config = normalizeChartConfig(parsed);
                                    if (!config) {
                                        throw new Error('Unsupported chart schema');
                                    }
                                    return <DynamicChart config={config} />;
                                } catch (e) {
                                    if (match[1] === 'chart') {
                                        return (
                                            <div className="my-4 sm:my-6 p-3 sm:p-4 rounded-xl bg-[var(--status-error)]/5 border border-[var(--status-error)]/20 flex flex-col gap-2 sm:gap-3">
                                                <div className="flex items-center gap-2 text-[var(--status-error)]">
                                                    <TrendingUp size={16} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Visualization Pipeline Halted</span>
                                                </div>
                                                <p className="text-[11px] font-bold text-[var(--text-secondary)] leading-relaxed">
                                                    The AI encountered a structural error while generating this chart. The raw data payload is retained below for manual audit.
                                                </p>
                                                <div className="mt-2 opacity-60 grayscale scale-[0.98] pointer-events-none">
                                                    <SyntaxHighlighter
                                                        style={syntaxTheme}
                                                        language="json"
                                                        PreTag="div"
                                                        customStyle={{ margin: 0, borderRadius: '8px', fontSize: '11px' }}
                                                    >
                                                        {codeString.slice(0, 500)}
                                                    </SyntaxHighlighter>
                                                </div>
                                            </div>
                                        );
                                    }
                                }
                            }

                            const codeId = getCodeId(codeString, match1);
                            return (
                                <div 
                                    className="my-6 rounded-xl overflow-hidden shadow-lg"
                                    style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-elevated)' }}
                                >
                                    <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-subtle-2">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">{match1}</span>
                                        {handleCopyCode && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopyCode(codeString, codeId)}
                                                className="text-[10px] font-bold text-[var(--accent)] hover:brightness-110 transition-all focus-ring rounded px-2 py-0.5"
                                            >
                                                {copiedBlockId === codeId ? 'Copied!' : 'Copy'}
                                            </button>
                                        )}
                                    </div>
                                    <SyntaxHighlighter
                                        style={syntaxTheme}
                                        language={match1}
                                        PreTag="div"
                                        customStyle={{ margin: 0, borderRadius: 0, padding: '20px', fontSize: '13px', backgroundColor: 'transparent' }}
                                        showLineNumbers
                                        wrapLines
                                        lineNumberStyle={{
                                            color: 'var(--text-tertiary)',
                                            opacity: 0.3,
                                            minWidth: '3em'
                                        }}
                                        {...props}
                                    >
                                        {codeString}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        }
                        return (
                            <code className={cn("px-1.5 py-0.5 rounded-md bg-subtle-10 text-[var(--accent)] font-mono text-[0.9em]", className)} {...props}>
                                {children}
                            </code>
                        );
                    },
                    table({ children }: any) {
                        return (
                            <div 
                                className="my-6 rounded-xl overflow-x-auto custom-scrollbar-h shadow-md"
                                style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-elevated)' }}
                            >
                                <table className="w-full text-sm border-collapse">{children}</table>
                            </div>
                        );
                    },
                    th({ children }: any) {
                        return <th className="px-4 py-3 text-left font-bold text-[var(--text-heading)] border-b border-[var(--border-subtle)] bg-subtle-2 uppercase tracking-widest text-[10px]">{children}</th>;
                    },
                    td({ children }: any) {
                        return <td className="px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 text-[var(--text-body)]">{children}</td>;
                    },
                    p({ children }) {
                        return <p className="mb-4 last:mb-0 leading-relaxed text-[var(--text-body)] font-medium">{children}</p>;
                    },
                    ul({ children }) {
                        return <ul className="list-disc pl-6 mb-6 flex flex-col gap-4 marker:text-[var(--accent)]">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="list-decimal pl-6 mb-6 flex flex-col gap-4 marker:text-[var(--accent)] font-bold">{children}</ol>;
                    },
                    li({ children }) {
                        return <li className="pl-2 text-[var(--text-body)] font-medium">{children}</li>;
                    }
                }}
            >
                {(Array.isArray(healedContent) ? healedContent.join('\n') : normalizeTables(cleanContent(healedContent))) + (isLast && isLoading ? ' |' : '')}
            </ReactMarkdown>

            {sources.length > 0 && (
                <div className="mt-8 pt-8 border-t border-[var(--border-subtle)] relative">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1 h-5 rounded-full bg-[var(--accent)]" />
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-heading)]">Knowledge Grounding</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {sources.map((source, i) => (
                            <div 
                                key={i} 
                                className="flex items-center gap-4 p-4 rounded-xl transition-all duration-300"
                                style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
                            >
                                <div className="w-10 h-10 rounded-lg bg-subtle-5 flex items-center justify-center text-[var(--accent)]">
                                    <FileText size={18} strokeWidth={2} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-bold text-[var(--text-heading)] truncate uppercase tracking-tight">{source}</span>
                                    <span className="text-[9px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest mt-1">Verified Source</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});
