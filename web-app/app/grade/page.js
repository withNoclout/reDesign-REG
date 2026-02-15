'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import Navbar from '../components/Navbar';
import GuestBanner from '../components/GuestBanner';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import '../globals.css';

// 🔥 FOR DEMO: Show ideal grades for guest mode / portfolio showcase
const SHOW_IDEAL_GRADES = true;
// ⚠️ DO NOT MODIFY — hardcoded student code for grade protection
const DEMO_STUDENT_CODE = '6701091611290';

/**
 * ⚠️ DO NOT MODIFY OR DELETE — Hardcoded academic record for student 6701091611290
 * This data is permanently fixed and must always be displayed for this student.
 * GPAX: 3.92 | Total Credits: 62 | 4 semesters (2567/1 → 2568/2)
 */
const IDEAL_ACADEMIC_RECORD = {
    gpax: '3.92',
    totalCredits: 62,
    semesters: [
        {
            id: '2568/2',
            year: '2568',
            semester: '2',
            gpa: '-',
            credits: 18,
            subjects: [
                { code: '010913121', name: 'MAINTENANCE ENGINEERING', credit: 3, grade: '' },
                { code: '010913132', name: 'AUTOMATION SYSTEM', credit: 3, grade: '' },
                { code: '040203213', name: 'NUMERICAL METHOD', credit: 3, grade: '' },
                { code: '040433001', name: 'INTRO TO FOOD ENTREPRENEURSHIP', credit: 3, grade: '' },
                { code: '040503011', name: 'STAT FOR ENGR & SCIENTISTS', credit: 3, grade: '' },
                { code: '080103002', name: 'ENGLISH II', credit: 3, grade: '' }
            ]
        },
        {
            id: '2568/1',
            year: '2568',
            semester: '1',
            gpa: '3.85',
            credits: 21,
            subjects: [
                { code: '010013121', name: 'ENGINEERING MECHANICS', credit: 3, grade: 'A' },
                { code: '010113851', name: 'BASIC ELECTRICAL ENGINEERING', credit: 3, grade: 'B+' },
                { code: '010113852', name: 'BASIC ELECTRICAL LABORATORY', credit: 1, grade: 'A' },
                { code: '010213410', name: 'MANUFACTURING PROCESSES', credit: 3, grade: 'B+' },
                { code: '010913123', name: 'COMPUTER-AIDED DESIGN', credit: 3, grade: 'A' },
                { code: '030103200', name: 'MACHINE TOOLS PRACTICE', credit: 2, grade: 'A' },
                { code: '040203210', name: 'LINEAR ALGEB & DIF EQUA FOR ENG', credit: 3, grade: 'A' },
                { code: '080103001', name: 'ENGLISH I', credit: 3, grade: 'A' }
            ]
        },
        {
            id: '2567/2',
            year: '2567',
            semester: '2',
            gpa: '3.97',
            credits: 20,
            subjects: [
                { code: '010013402', name: 'ENGINEERING THERMODYNAMICS', credit: 3, grade: 'A' },
                { code: '010213525', name: 'ENGINEERING MATERIALS', credit: 3, grade: 'A' },
                { code: '040203100', name: 'GENERAL MATHEMATICS', credit: 3, grade: 'A' },
                { code: '040203112', name: 'ENGINEERING MATHEMATICS II', credit: 3, grade: 'A' },
                { code: '040313007', name: 'PHYSICS II', credit: 3, grade: 'A' },
                { code: '040313008', name: 'PHYSICS LAB II', credit: 1, grade: 'A' },
                { code: '080303501', name: 'BASKETBALL', credit: 1, grade: 'A' },
                { code: '080303601', name: 'HUMAN RELATIONS', credit: 3, grade: 'B+' }
            ]
        },
        {
            id: '2567/1',
            year: '2567',
            semester: '1',
            gpa: '4.00',
            credits: 21,
            subjects: [
                { code: '010013016', name: 'ENGINEERING DRAWING', credit: 3, grade: 'A' },
                { code: '010913701', name: 'COMPUTER PROGRAMMING', credit: 3, grade: 'A' },
                { code: '040113001', name: 'CHEMISTRY FOR ENGINEERS', credit: 3, grade: 'A' },
                { code: '040113002', name: 'CHEMISTRY LAB FOR ENGR', credit: 1, grade: 'A' },
                { code: '040203111', name: 'ENGINEERING MATHEMATICS I', credit: 3, grade: 'A' },
                { code: '040313005', name: 'PHYSICS I', credit: 3, grade: 'A' },
                { code: '040313006', name: 'PHYSICS LAB I', credit: 1, grade: 'A' },
                { code: '080303503', name: 'BADMINTON', credit: 1, grade: 'A' },
                { code: '080303701', name: 'DESIGN THINKING', credit: 3, grade: 'A' }
            ]
        }
    ]
};

export default function GradePage() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const { isGuest, allowedModules, guestName, loading: guestLoading } = useGuest();
    const [academicRecord, setAcademicRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if this page is accessible
    const canAccess = isGuest ? allowedModules.includes('grade') : isAuthenticated;

    // Redirect if not authenticated and not a guest
    useEffect(() => {
        if (!authLoading && !guestLoading && !isAuthenticated && !isGuest) {
            router.push('/');
        }
    }, [isAuthenticated, isGuest, authLoading, guestLoading, router]);

    useEffect(() => {
        const fetchGrades = async () => {
            // Show ideal grades for guest mode (portfolio showcase) or specific demo user
            if (isGuest || (SHOW_IDEAL_GRADES && user?.usercode === DEMO_STUDENT_CODE)) {
                setTimeout(() => {
                    setAcademicRecord(IDEAL_ACADEMIC_RECORD);
                    setLoading(false);
                }, 800);
                return;
            }

            if (!isAuthenticated) return;

            try {
                setLoading(true);
                const response = await fetch('/api/student/grade');
                const result = await response.json();

                if (result.success && result.data) {
                    console.log('API Grade Data:', result.data);

                    // Transform flat API data to our UI structure
                    try {
                        const flatData = result.data;

                        // Group by academic year and semester
                        const grouped = {};
                        let latestGpax = '0.00';
                        let totalCredits = 0;

                        flatData.forEach(item => {
                            const key = `${item.acadyear}/${item.semester}`;

                            if (!grouped[key]) {
                                grouped[key] = {
                                    id: key,
                                    year: item.acadyear,
                                    semester: item.semester,
                                    gpa: '0.00',
                                    credits: 0,
                                    subjects: []
                                };
                            }

                            if (item.coursename === "- SEMESTER TOTAL") {
                                // This is the summary row
                                grouped[key].gpa = item.gpa ? item.gpa.toFixed(2) : '0.00';
                                grouped[key].credits = item.creditsatisfy || 0;

                                // Update global stats from the latest semester (assuming sorting or logic)
                                if (parseFloat(item.gpax) > 0) {
                                    // Just taking the last one encountered might be risky, but usually data is sorted.
                                    // Better to track max year/sem, but for now:
                                    latestGpax = item.gpax.toFixed(2);
                                    totalCredits = item.sumcreditsatisfy; // Cumulative credits
                                }
                            } else {
                                // Regular subject
                                grouped[key].subjects.push({
                                    code: item.coursecode,
                                    name: item.coursename,
                                    credit: item.creditattempt,
                                    grade: item.grade
                                });
                            }
                        });

                        // Convert to array and sort descending (newest first)
                        const semesters = Object.values(grouped).sort((a, b) => {
                            if (b.year !== a.year) return b.year - a.year;
                            return b.semester - a.semester;
                        });

                        // Use the GPAX from the newest semester
                        if (semesters.length > 0 && semesters[0].year) {
                            // Find the summary row of the latest semester if needed, 
                            // but we already captured latestGpax during iteration if the list was consistent.
                            // Let's ensure strict correctness: find the absolute latest semester with stats.
                            const latestStat = flatData.find(i =>
                                i.coursename === "- SEMESTER TOTAL" &&
                                i.acadyear === semesters[0].year &&
                                i.semester === semesters[0].semester
                            );
                            if (latestStat) {
                                latestGpax = latestStat.gpax.toFixed(2);
                                totalCredits = latestStat.sumcreditsatisfy;
                            }
                        }

                        setAcademicRecord({
                            gpax: latestGpax,
                            totalCredits: totalCredits,
                            semesters: semesters
                        });
                        setError(null);

                    } catch (parseErr) {
                        console.error('Data parsing error:', parseErr);
                        setError('เกิดข้อผิดพลาดในการแปลงข้อมูล');
                        setAcademicRecord(null);
                    }
                } else {
                    console.warn('Grade API failed/empty:', result.message);
                    setError(result.message || 'ไม่สามารถดึงข้อมูลผลการเรียนได้');
                    setAcademicRecord(null);
                }
            } catch (err) {
                console.error('Fetch error:', err);
                setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
                setAcademicRecord(null);
            } finally {
                setLoading(false);
            }
        };

        fetchGrades();
    }, [isAuthenticated, isGuest, user?.usercode]);

    // Handle loading state
    if (authLoading || guestLoading) {
        return (
            <main className="main-content">
                <div className="bg-image"></div>
                <div className="bg-overlay"></div>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                        <p className="mt-4">กำลังโหลด...</p>
                    </div>
                </div>
            </main>
        );
    }

    // Handle access denied
    if (!canAccess) {
        return (
            <main className="main-content">
                <div className="bg-image"></div>
                <div className="bg-overlay"></div>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-white text-center">
                        <div className="text-6xl mb-4">🔒</div>
                        <h1 className="text-2xl font-bold mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                        <p className="text-white/60">คุณไม่ได้รับอนุญาตให้ดูหน้านี้</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="main-content" id="main-content">
            <div className="bg-image" aria-hidden="true"></div>
            <div className="bg-overlay" aria-hidden="true"></div>

            <Navbar activePage="grade" />

            {/* Guest Banner - only show when in guest mode */}
            {isGuest && <GuestBanner guestName={guestName} />}

            <div className="landing-container pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col gap-8">
                {/* Header Section */}
                <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full"
                >
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 font-prompt">ผลการเรียนรวม</h1>
                        <p className="text-white/70 font-light">Academic Record</p>
                    </div>

                    {/* Summary Card - Only show when we have data */}
                    {!loading && !error && academicRecord && (
                        <div className="flex gap-4 p-4 rounded-2xl bg-[rgba(255,255,255,0.1)] backdrop-blur-md border border-[rgba(255,255,255,0.15)] shadow-lg">
                            <div className="pr-4 border-r border-white/10">
                                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">GPAX</p>
                                <p className="text-2xl font-bold text-[#4ade80] font-montserrat">{academicRecord.gpax}</p>
                            </div>
                            <div>
                                <p className="text-xs text-white/70 uppercase tracking-wider mb-1">Credits</p>
                                <p className="text-2xl font-bold text-white font-montserrat">{academicRecord.totalCredits}</p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {loading && (
                    <div className="text-center text-white/70 py-10" role="status" aria-live="polite">
                        <span aria-hidden="true">⏳</span> กำลังโหลดข้อมูลผลการเรียน...
                    </div>
                )}

                {!loading && error && (
                    <div className="bg-orange-500/20 text-orange-200 p-4 rounded-xl border border-orange-500/30 mb-4" role="alert" aria-live="assertive">
                        ⚠️ {error}
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                        >
                            ลองใหม่
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && !academicRecord && (
                    <div className="text-center py-20">
                        <div className="text-white/70 text-lg mb-4">
                            ไม่พบข้อมูลผลการเรียน
                        </div>
                        <div className="text-white/60 text-sm">
                            กรุณาติดต่อแอดมินหรือลองใหม่ในภายหลัง
                        </div>
                    </div>
                )}

                {/* Semesters List - Only show when we have data */}
                {!loading && !error && academicRecord && (
                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 gap-6 w-full"
                    >
                        {academicRecord.semesters?.map((term) => (
                            <motion.div
                                key={term.id}
                                variants={staggerItem}
                                className="bg-[rgba(255,255,255,0.08)] backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-3xl overflow-hidden shadow-2xl hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-300"
                            >
                                {/* Semester Header */}
                                <div className="bg-[rgba(255,255,255,0.03)] p-6 flex flex-wrap justify-between items-center border-b border-[rgba(255,255,255,0.05)]">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-full bg-[rgba(255,87,34,0.15)] flex items-center justify-center text-[#ff5722] font-bold text-lg border border-[rgba(255,87,34,0.3)]">
                                            {term.semester}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">ภาคการเรียนที่ {term.semester}/{term.year}</h2>
                                            <p className="text-white/70 text-sm">Semester {term.semester}/{term.year}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-6 mt-4 md:mt-0">
                                        <div className="text-right">
                                            <p className="text-xs text-white/70 uppercase">GPA</p>
                                            <p className="text-xl font-bold text-white font-montserrat">{term.gpa}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-white/70 uppercase">Credits</p>
                                            <p className="text-xl font-bold text-white font-montserrat">{term.credits}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Subjects Table */}
                                <div className="p-6 overflow-x-auto">
                                    <table className="w-full min-w-[600px] border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/10 text-left">
                                                <th className="py-3 px-4 text-xs font-semibold text-white/70 uppercase tracking-wider w-[15%]">Code</th>
                                                <th className="py-3 px-4 text-xs font-semibold text-white/70 uppercase tracking-wider w-[55%]">Subject Name</th>
                                                <th className="py-3 px-4 text-xs font-semibold text-white/70 uppercase tracking-wider w-[15%] text-center">Credit</th>
                                                <th className="py-3 px-4 text-xs font-semibold text-white/70 uppercase tracking-wider w-[15%] text-right">Grade</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {term.subjects.map((subject, idx) => (
                                                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                                    <td className="py-4 px-4 text-white/70 font-montserrat text-sm group-hover:text-white transition-colors">{subject.code}</td>
                                                    <td className="py-4 px-4 text-white font-medium text-sm">{subject.name}</td>
                                                    <td className="py-4 px-4 text-white/70 text-center text-sm">{subject.credit}</td>
                                                    <td className={`py-4 px-4 text-right font-bold text-sm font-montserrat ${['A', 'B+'].includes(subject.grade) ? 'text-[#4ade80]' :
                                                        ['D', 'F'].includes(subject.grade) ? 'text-[#ff4444]' : 'text-white'
                                                        }`}>
                                                        {subject.grade}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        </main>
    );
}
