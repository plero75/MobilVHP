
import React, { useState, useEffect } from 'react';
import { TransportCard } from './TransportCard';
import { Card } from './Card';
import { STOP_IDS, JOINVILLE_BUS_DISCOVERY_ID } from '../constants';
import { fetchStopMonitoring, fetchAllBusesSummary, hhmm } from '../services/api';
import type { BusSummary } from '../types';
import { useInterval } from '../hooks/useInterval';

const RER_A_CONFIG = [
    { type: 'filter' as const, lineId: 'C01742', test: (dest: string) => /(paris|défense|nanterre|poissy|cergy|nation|etoile|haussmann)/i.test(dest), destName: 'Vers Paris', meta: { code: "RER A", color: "#e41e26", text: "#fff" } },
    { type: 'filter' as const, lineId: 'C01742', test: (dest:string) => /(boissy|marne|val d'europe|chessy|torcy|noisiel|bussy|noisy|fontenay|bry|champigny)/i.test(dest), destName: 'Vers Marne-la-Vallée / Boissy', meta: { code: "RER A", color: "#e41e26", text: "#fff" } }
];

const HIPPO_CONFIG = [{ type: 'code' as const, value: '77', lineId: 'C02251' }];
const BREUIL_CONFIG = [{ type: 'code' as const, value: '201', lineId: 'C01219' }, { type: 'code' as const, value: '77', lineId: 'C02251' }];

const BusLine: React.FC<{ summary: BusSummary }> = ({ summary }) => {
    const { meta, planned, directions } = summary;
    const hasRealTimeData = directions.some(d => d.list.length > 0);

    return (
        <div className="bg-[#f7f9ff] border border-app-panel-border rounded-lg p-2 my-2">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center justify-center min-w-[44px] h-6 px-2.5 rounded-full font-extrabold"
                      style={{ backgroundColor: meta.color, color: meta.text }}
                    >
                      {meta.code}
                    </span>
                    <span className="font-semibold text-app-text">{meta.name}</span>
                </div>
                {planned.first && planned.last && (
                    <div className="text-xs text-gray-500">
                        Service de {hhmm(planned.first)} à {hhmm(planned.last)}
                    </div>
                )}
            </div>
            <div className="space-y-3">
                {hasRealTimeData ? (
                    directions.map((dir, index) => (
                        <div key={index} className="grid grid-cols-2 items-center text-sm gap-2">
                            <div className="font-bold text-app-blue truncate">{dir.dest || 'Direction'}</div>
                            <div className="flex flex-wrap gap-2 justify-end">
                                {dir.list.map((visit, vIndex) => {
                                    let text: React.ReactNode = visit.minutes !== null ? `${visit.minutes} min` : '...';
                                    let titleText = `Prévu à ${hhmm(visit.expected)}`;
                                    let className = 'font-bold text-center px-2 py-1.5 rounded-md text-sm min-w-[70px] transition-all';
                                    
                                    if (visit.cancelled) {
                                      className += ' bg-red-100 text-red-700 line-through';
                                      text = 'Supp.';
                                      titleText = 'Supprimé';
                                    } else if (visit.delayMin && visit.delayMin > 0) {
                                      className += ' bg-yellow-100 text-yellow-800 border border-yellow-300';
                                      titleText += ` (retard ${visit.delayMin} min)`;
                                    } else if (visit.minutes !== null && visit.minutes <= 1) {
                                      className += ' bg-green-100 text-green-800 border-2 border-green-400 animate-pulse';
                                      text = "Approche";
                                    } else {
                                      className += ' bg-blue-100 text-blue-800';
                                    }

                                    return (
                                      <div key={vIndex} className={className} title={titleText}>
                                        {text}
                                      </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-xs text-gray-500 text-center py-2 italic">
                        Pas de service en temps réel. Données théoriques indisponibles.
                    </div>
                )}
            </div>
        </div>
    );
};

const BusList: React.FC<{ summaries: BusSummary[], loading: boolean }> = ({ summaries, loading }) => {
    if (loading) {
        return <div className="text-center text-sm text-gray-500 py-4">Découverte et chargement des lignes de bus...</div>;
    }
    if (summaries.length === 0) {
        return <div className="text-center text-sm text-gray-500 py-4">Aucune ligne de bus trouvée ou service interrompu.</div>;
    }

    const half = Math.ceil(summaries.length / 2);
    const leftList = summaries.slice(0, half);
    const rightList = summaries.slice(half);

    const renderList = (list: BusSummary[]) => list.map(s => <BusLine key={s.meta.code} summary={s} />);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <div>{renderList(leftList)}</div>
            <div>{renderList(rightList)}</div>
        </div>
    );
};


export const TransportSection: React.FC = () => {
    const [busSummaries, setBusSummaries] = useState<BusSummary[]>([]);
    const [busLoading, setBusLoading] = useState(true);

    const loadBusData = async () => {
        setBusLoading(true);
        try {
            const summary = await fetchAllBusesSummary(JOINVILLE_BUS_DISCOVERY_ID, STOP_IDS.JOINVILLE_BUS_SIRI);
            setBusSummaries(summary);
        } catch (error) {
            console.error("Failed to fetch bus summary:", error);
            setBusSummaries([]);
        } finally {
            setBusLoading(false);
        }
    };
    
    useEffect(() => {
        loadBusData();
    }, []);

    useInterval(loadBusData, 60 * 1000);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TransportCard
                    title={<><strong>Joinville-le-Pont</strong> — RER A</>}
                    stopId={STOP_IDS.RER_A}
                    lineConfigs={RER_A_CONFIG}
                    fetchFn={fetchStopMonitoring}
                />
                <TransportCard
                    title={<><strong>Hippodrome de Vincennes</strong> — Bus 77</>}
                    stopId={STOP_IDS.HIPPODROME}
                    lineConfigs={HIPPO_CONFIG}
                    fetchFn={fetchStopMonitoring}
                />
                <TransportCard
                    title={<><strong>École du Breuil</strong> — Bus 201 / 77</>}
                    stopId={STOP_IDS.BREUIL}
                    lineConfigs={BREUIL_CONFIG}
                    fetchFn={fetchStopMonitoring}
                />
            </div>
            <div className="grid grid-cols-1 gap-4">
                 <Card
                    title={<><strong>Joinville-le-Pont</strong> — Tous les bus (hors RER)</>}
                    fullWidth
                 >
                    <BusList summaries={busSummaries} loading={busLoading} />
                 </Card>
            </div>
        </>
    );
};
