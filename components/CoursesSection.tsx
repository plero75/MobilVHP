
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './Card';
import { useInterval } from '../hooks/useInterval';
import { fetchCourses } from '../services/api';
import type { Course } from '../types';

const CourseItem: React.FC<{ course: Course }> = ({ course }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 10000); // update every 10s for live countdown
        return () => clearInterval(timer);
    }, []);

    const getStatus = () => {
        const mins = Math.round((course.ts - now) / 60000);
        if (mins > 0) return `dans ${mins} min`;
        if (mins > -60) return "en cours";
        return "terminée";
    };

    return (
        <div className="flex items-center justify-between py-1.5 border-b border-dashed border-gray-200 last:border-b-0">
            <div className="flex items-center gap-3">
                <div className="font-extrabold rounded-lg py-1 px-2 bg-[#eef2ff] text-[#1f2a7a] min-w-[72px] text-center">
                    {course.heure}
                </div>
                <div>
                    <div className="font-bold">{course.ref} — {course.lib}</div>
                    <div className="text-xs text-gray-500">{course.dist} m • {course.disc} • {getStatus()}</div>
                </div>
            </div>
            <div className="text-xs text-gray-500 font-medium">
                {Number(course.dot || 0).toLocaleString("fr-FR")} €
            </div>
        </div>
    );
};

const CoursesCard: React.FC<{ title: string; courses: Course[]; loading: boolean }> = ({ title, courses, loading }) => (
    <Card title={<strong>{title}</strong>}>
        <div className="courses">
            {loading ? (
                <div>Chargement...</div>
            ) : courses.length > 0 ? (
                courses.map((c) => <CourseItem key={c.ref} course={c} />)
            ) : (
                <div className="text-sm text-gray-500">Aucune course aujourd’hui.</div>
            )}
        </div>
    </Card>
);

let coursesCache: { vin: Course[], eng: Course[], day: string | null } = { vin: [], eng: [], day: null };

export const CoursesSection: React.FC = () => {
    const [vincennes, setVincennes] = useState<Course[]>([]);
    const [enghien, setEnghien] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    const loadCourses = useCallback(async () => {
        const today = new Date().toLocaleDateString('fr-FR');
        // Fetch once per day, but allow component to re-render for countdown
        if (coursesCache.day !== today) {
            setLoading(true);
            const { vin, eng } = await fetchCourses();
            coursesCache = { vin, eng, day: today };
            setVincennes(vin);
            setEnghien(eng);
            setLoading(false);
        } else {
            // Force re-render without fetching
             setVincennes([...coursesCache.vin]);
             setEnghien([...coursesCache.eng]);
        }
    }, []);

    useEffect(() => {
        loadCourses();
    }, [loadCourses]);

    useInterval(loadCourses, 60 * 1000); // Check for updates and re-render every minute

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CoursesCard title="Prochaines courses — Vincennes" courses={vincennes} loading={loading} />
            <CoursesCard title="Prochaines courses — Enghien" courses={enghien} loading={loading} />
        </div>
    );
};
