import React, { useState, useEffect, useCallback } from 'react';
import type { Visit, Direction, LineMeta, GtfsFallback, LineGroup } from '../types';
import { Card } from './Card';
import { gtfsFallback, getMetaByCode, getMetaById, fetchTrafficMessages, getDailySchedule } from '../services/api';
import { useInterval } from '../hooks/useInterval';
import { LineBlock } from './LineBlock';


interface TransportCardProps {
    title: React.ReactNode;
    stopId: string;
    lineConfigs: ({ type: 'code'; value: string; lineId: string; } | { type: 'id'; value: string; lineId?: string; } | { type: 'filter'; test: (dest: string) => boolean; destName: string; meta: LineMeta; lineId: string; })[];
    fetchFn: (stopId: string) => Promise<Visit[]>;
    perDir?: number;
    className?: string;
    fullWidth?: boolean;
    children?: (lineGroups: LineGroup[], loading: boolean, fallbacks: Record<string, GtfsFallback | null>, schedules: Record<string, { first: string | null; last: string | null; }>) => React.ReactNode;
}

type DailySchedule = { first: string | null; last: string | null };

const groupByLineAndDir = async (visits: Visit[], perDir: number): Promise<LineGroup[]> => {
    const byKey = new Map<string, { lineId: string | null; dest: string; list: Visit[] }>();
    visits.forEach(v => {
        const key = (v.lineId || "unknown") + "|" + v.dest.toLowerCase();
        if (!byKey.has(key)) byKey.set(key, { lineId: v.lineId, dest: v.dest, list: [] });
        if (v.minutes !== null) byKey.get(key)!.list.push(v);
    });

    const byLine = new Map<string, { lineId: string | null; dirs: Direction[] }>();
    for (const g of byKey.values()) {
        if (!g.lineId) continue;
        if (!byLine.has(g.lineId)) byLine.set(g.lineId, { lineId: g.lineId, dirs: [] });
        byLine.get(g.lineId)!.dirs.push({
            dest: g.dest,
            list: g.list.sort((a, b) => a.minutes! - b.minutes!).slice(0, perDir)
        });
    }

    const resultPromises = Array.from(byLine.values()).map(async (lg) => {
        const meta = await getMetaById(lg.lineId!);
        return { ...lg, meta };
    });

    return Promise.all(resultPromises);
}

const TrafficAlerts: React.FC<{ messages: string[] }> = ({ messages }) => {
    if (messages.length === 0) return null;
    return (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-2 text-xs mb-2 rounded-md space-y-1">
            {messages.map((msg, i) => <p key={i} className="font-medium">{msg}</p>)}
        </div>
    );
};

export const TransportCard: React.FC<TransportCardProps> = ({ title, stopId, lineConfigs, fetchFn, perDir = 3, className, fullWidth, children }) => {
    const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
    const [fallbacks, setFallbacks] = useState<Record<string, GtfsFallback | null>>({});
    const [schedules, setSchedules] = useState<Record<string, DailySchedule>>({});
    const [trafficMessages, setTrafficMessages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const allVisits = await fetchFn(stopId);

        const lineIds = new Set<string>();
        lineConfigs.forEach(c => {
            if('lineId' in c && c.lineId) lineIds.add(c.lineId);
            else if (c.type === 'id' && c.value) lineIds.add(c.value);
        });
        const msgs = await fetchTrafficMessages(Array.from(lineIds));
        setTrafficMessages(msgs);
        
        if (Array.isArray(lineConfigs) && lineConfigs.length > 0 && 'test' in lineConfigs[0]) {
             // Special case for RER A filtering
             const groups: LineGroup[] = lineConfigs.map(config => {
                 if ('test' in config) {
                    return {
                        lineId: 'C01742',
                        meta: config.meta,
                        dirs: [{
                            dest: config.destName,
                            list: allVisits.filter(v => config.test(v.dest)).slice(0, perDir)
                        }]
                    };
                 }
                 return null;
             }).filter((g): g is LineGroup => g !== null);
             setLineGroups(groups);

             if (groups.every(g => g.dirs.every(d => d.list.length === 0))) {
                 const fb = await gtfsFallback('C01742', stopId);
                 setFallbacks({'C01742': fb});
             }

        } else {
            const grouped = await groupByLineAndDir(allVisits, perDir);
            const codes = Array.isArray(lineConfigs) ? lineConfigs.map(c => 'value' in c ? c.value.toUpperCase() : null).filter(Boolean) : [];
            const finalGroups: LineGroup[] = [];
            const handledLineIds = new Set<string>();

            // Add groups with data first
            for (const g of grouped) {
                if (g.lineId && (codes.length === 0 || codes.includes(g.meta.code.toUpperCase()))) {
                    finalGroups.push(g);
                    handledLineIds.add(g.meta.code.toUpperCase());
                }
            }

            // Add empty groups for forced display
            if (Array.isArray(lineConfigs)) {
                for (const config of lineConfigs) {
                    if ('value' in config && !handledLineIds.has(config.value.toUpperCase())) {
                        const meta = config.type === 'id' ? await getMetaById(config.value) : await getMetaByCode(config.value);
                        // 'lineId' in config is a type guard, but we need to ensure config is the right type first
                        const lineId = ('lineId' in config) ? config.lineId : null;
                        finalGroups.push({ lineId, meta, dirs: [] });
                    }
                }
            }
            
            setLineGroups(finalGroups);
            
            const newFallbacks: Record<string, GtfsFallback | null> = {};
            const newSchedules: Record<string, DailySchedule> = {};

            // Fetch schedules and fallbacks sequentially to avoid rate-limiting (HTTP 429).
            for (const group of finalGroups) {
                if (group.lineId) {
                    newSchedules[group.meta.code] = await getDailySchedule(group.lineId, stopId);
                    if (group.dirs.every(d => d.list.length === 0)) {
                       newFallbacks[group.meta.code] = await gtfsFallback(group.lineId, stopId);
                    }
                }
            }

            setSchedules(newSchedules);
            setFallbacks(newFallbacks);
        }

        setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stopId, fetchFn, perDir, JSON.stringify(lineConfigs)]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useInterval(fetchData, 60 * 1000);

    if (children) {
        return <Card title={title} className={className} fullWidth={fullWidth}><TrafficAlerts messages={trafficMessages} />{children(lineGroups, loading, fallbacks, schedules)}</Card>;
    }

    return (
        <Card title={title} className={className} fullWidth={fullWidth}>
            <TrafficAlerts messages={trafficMessages} />
            {loading ? (
                <div>Chargement...</div>
            ) : lineGroups.length > 0 ? (
                lineGroups.map((lg) => (
                    <LineBlock key={lg.meta.code} lineGroup={lg} fallback={fallbacks[lg.meta.code]} schedule={schedules[lg.meta.code]} />
                ))
            ) : (
                <div>Aucune donnée disponible.</div>
            )}
        </Card>
    );
};