'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// --- Styles ---
const styles = {
    container: {
        marginTop: '1.5rem',
        padding: '1.5rem',
        backgroundColor: '#1E1E1E',
        borderRadius: '12px',
        border: '1px solid #333',
        color: '#FFF',
        overflowX: 'auto'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
    },
    title: {
        fontSize: '1.something rem',
        fontWeight: 'bold',
        color: '#E0E0E0'
    },
    screenArea: {
        width: '80%',
        height: '30px',
        margin: '0 auto 2rem auto',
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)',
        borderTop: '3px solid #666',
        borderRadius: '50% 50% 0 0 / 10px 10px 0 0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#888',
        fontSize: '0.8rem',
        textTransform: 'uppercase',
        letterSpacing: '2px'
    },
    gridContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'center',
        paddingBottom: '2rem'
    },
    row: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
    },
    rowLabel: {
        width: '30px',
        textAlign: 'right',
        marginRight: '10px',
        color: '#888',
        fontWeight: 'bold',
        fontSize: '0.9rem'
    },
    seat: {
        width: '32px',
        height: '32px',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    },
    seatEmpty: {
        backgroundColor: 'transparent',
        border: '1px dashed #444',
        cursor: 'default',
        boxShadow: 'none'
    },
    tooltip: {
        position: 'absolute',
        bottom: '120%',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#FFF',
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '0.8rem',
        whiteSpace: 'nowrap',
        zIndex: 10,
        pointerEvents: 'none',
        border: '1px solid #444',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
    },
    legend: {
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center',
        marginTop: '1.5rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid #333'
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.85rem',
        color: '#BBB'
    },
    legendBox: {
        width: '16px',
        height: '16px',
        borderRadius: '4px'
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1rem',
        textAlign: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px dashed rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        margin: '2rem 0'
    }
};

/**
 * ExamSeatMap Component
 * @param {string} courseCode - รหัสวิชาที่ต้องการดึงผังที่นั่ง
 * @param {string} myStudentId - รหัสนักศึกษาของผู้ใช้ (ใช้ทำ color-coding)
 */
export default function ExamSeatMap({ courseCode, myStudentId }) {
    const [seatData, setSeatData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hoveredSeat, setHoveredSeat] = useState(null);

    useEffect(() => {
        const fetchSeatMap = async () => {
            try {
                setLoading(true);
                // Preserve dashes but ensure it's standard URL encoded (don't strip characters natively)
                const safeCourseCode = encodeURIComponent(courseCode.trim());

                const response = await axios.get(`/api/student/exam-seat?courseCode=${safeCourseCode}`);
                setSeatData(response.data);
                setError(null);
            } catch (err) {
                console.error("Failed to load seat map", err);
                setError("ไม่พบข้อมูลเก้าอี้สอบ หรือคุณไม่ได้สอบวิชานี้");
            } finally {
                setLoading(false);
            }
        };

        if (courseCode) {
            fetchSeatMap();
        }
    }, [courseCode]);

    if (loading) {
        return (
            <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full border-4 border-t-orange-500 border-gray-700 animate-spin mb-4"></div>
                    <p className="text-gray-400">กำลังโหลดผังที่นั่งสอบ...</p>
                </div>
            </div>
        );
    }

    if (error || !seatData) {
        return (
            <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ff6b6b' }}>
                {error || "ไม่พบข้อมูลที่นั่งสอบวิชานี้"}
            </div>
        );
    }

    const { gridDimensions, seats, currentUserDetails } = seatData;
    const { rows, cols } = gridDimensions;

    // สร้าง Grid 2D (แถว x ที่นั่ง)
    // อาเรย์ 1-based index (สมมติว่าเก้าอี้และแถวเริ่มที่ 1)
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

    seats.forEach(seat => {
        // บางครั้ง row/seat อาจจะชิฟไป หรือมหาลัยไม่ได้เริ่มที่ 1 ทุกครั้ง (แต่ส่วนใหญ่เป็นเลขพิกัด)
        // ระวัง index out of bounds ถ้าข้อมูล CSV ขัดข้อง
        if (seat.row > 0 && seat.row <= rows && seat.seat > 0 && seat.seat <= cols) {
            grid[seat.row - 1][seat.seat - 1] = seat;
        }
    });

    // --- Color Coding Logic ---
    const getSeatColor = (seat) => {
        if (!seat) return styles.seatEmpty;

        // 1. ที่นั่งของตัวเอง (สีเด่นสุด)
        if (seat.studentId === myStudentId) {
            return { backgroundColor: '#FF6B00', color: '#FFF', border: '2px solid #FFA500' };
        }

        // 2. หาเพื่อนร่วมคณะ/สาขา (อิงจากรหัส นศ. 13 หลัก)
        // เช่น 67 01 09 161 xxxx
        // 01 = รหัสคณะ, 09 = รหัสสาขา
        // Strip 's' prefix if present for exact 13-digit alignment
        const cleanMyId = myStudentId?.replace(/^s/i, '') || '';
        const myFacultyCode = cleanMyId.substring(2, 4);
        const myMajorCode = cleanMyId.substring(4, 6);
        const myYear = cleanMyId.substring(0, 2);

        const theirFacultyCode = seat.studentId.substring(2, 4);
        const theirMajorCode = seat.studentId.substring(4, 6);
        const theirYear = seat.studentId.substring(0, 2);

        if (theirFacultyCode === myFacultyCode && theirMajorCode === myMajorCode && theirYear === myYear) {
            // เพื่อนร่วมสาขา ปีเดียวกัน
            return { backgroundColor: '#4ADE80', color: '#064E3B', border: '1px solid #22C55E' };
        } else if (theirFacultyCode === myFacultyCode) {
            // เพื่อนร่วมคณะต่างสาขา (หรือต่างปี)
            return { backgroundColor: '#FBBF24', color: '#78350F', border: '1px solid #F59E0B' };
        }

        // 3. คนแปลกหน้า (เทาคล้ำๆ)
        return { backgroundColor: '#374151', color: '#D1D5DB', border: '1px solid #4B5563' };
    };

    // --- Stats Logic ---
    let myMajorCount = 0;
    let myFacultyCount = 0;
    let otherCount = 0;

    const cleanMyIdForStats = myStudentId?.replace(/^s/i, '') || '';
    const myFacultyCodeStats = cleanMyIdForStats.substring(2, 4);
    const myMajorCodeStats = cleanMyIdForStats.substring(4, 6);
    const myYearStats = cleanMyIdForStats.substring(0, 2);

    seats.forEach(seat => {
        if (seat.studentId === myStudentId) return;

        const theirFacultyCode = seat.studentId.substring(2, 4);
        const theirMajorCode = seat.studentId.substring(4, 6);
        const theirYear = seat.studentId.substring(0, 2);

        if (theirFacultyCode === myFacultyCodeStats && theirMajorCode === myMajorCodeStats && theirYear === myYearStats) {
            myMajorCount++;
        } else if (theirFacultyCode === myFacultyCodeStats) {
            myFacultyCount++;
        } else {
            otherCount++;
        }
    });

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div style={styles.title}>
                    ผังห้องสอบ: {seatData.courseInfo.location}
                </div>
                <div className="text-sm text-gray-400">
                    เวลาสอบ: {seatData.courseInfo.examTime}
                </div>
            </div>

            {/* หน้ากระดานห้องสอบ (Screen) */}
            <div style={styles.screenArea}>หน้าห้องสอบ / กระดาน</div>

            {/* Grid เก้าอี้ (ถ้ามีข้อมูลผัง) */}
            {rows > 0 && cols > 0 ? (
                <div style={styles.gridContainer}>
                    {grid.map((rowArray, rowIndex) => (
                        <div key={`row-${rowIndex}`} style={styles.row}>
                            {/* แถวที่ N (เช่น แถว 1, แถว 2 ... ด้านข้าง) */}
                            <div style={styles.rowLabel}>
                                {seatData.isEngineering ? String.fromCharCode(65 + rowIndex) : `R${rowIndex + 1}`}
                            </div>

                            {rowArray.map((seat, colIndex) => {
                                const isMySeat = seat?.studentId === myStudentId;
                                const seatColorStyle = getSeatColor(seat);

                                return (
                                    <motion.div
                                        key={`seat-${rowIndex}-${colIndex}`}
                                        style={{
                                            ...styles.seat,
                                            ...seatColorStyle,
                                            boxShadow: isMySeat ? '0 0 10px rgba(255, 107, 0, 0.8)' : styles.seat.boxShadow
                                        }}
                                        whileHover={seat ? { scale: 1.15, zIndex: 10 } : {}}
                                        onMouseEnter={() => seat && setHoveredSeat(seat)}
                                        onMouseLeave={() => setHoveredSeat(null)}
                                        animate={isMySeat ? { y: [0, -5, 0] } : {}}
                                        transition={isMySeat ? { duration: 1.5, repeat: Infinity } : { duration: 0.2 }}
                                    >
                                        {/* ตรงนี้จะพิมพ์อะไรในกล่องเก้าอี้ก็ได้ เช่น เลขที่นั่ง */}
                                        {seat ? (seat.seatLabel || seat.seat) : ''}

                                        {/* Tooltip เมื่อชี้เมาส์ */}
                                        <AnimatePresence>
                                            {hoveredSeat?.studentId === seat?.studentId && seat && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    style={styles.tooltip}
                                                >
                                                    <div className="font-bold text-orange-400">{seat.studentId}</div>
                                                    <div>{seat.name}</div>
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        ที่นั่ง: {seat.seatLabel || `${seat.row}-${seat.seat}`} (Sec {seat.section})
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ) : (
                <div style={styles.emptyState}>
                    <div className="text-gray-400 font-prompt mb-2 text-lg">No Seat Found / ไม่พบผังที่นั่งสอบ</div>
                    <div className="text-gray-500 text-sm">ระบบไม่มีการระบุพิกัดแถว/ที่นั่งของรายวิชานี้ (ฟีเจอร์นี้รองรับเฉพาะวิชาที่มีพิกัดชัดเจน เช่น คณะวิศวกรรมศาสตร์)</div>
                </div>
            )}

            {/* Legend คำอธิบายสี และสถิติ */}
            <div style={styles.legend}>
                <div style={styles.legendItem}>
                    <div style={{ ...styles.legendBox, backgroundColor: '#FF6B00' }}></div>
                    <span>ที่นั่งคุณ</span>
                </div>
                <div style={styles.legendItem}>
                    <div style={{ ...styles.legendBox, backgroundColor: '#4ADE80' }}></div>
                    <span>ร่วมสาขา ({myMajorCount})</span>
                </div>
                <div style={styles.legendItem}>
                    <div style={{ ...styles.legendBox, backgroundColor: '#FBBF24' }}></div>
                    <span>ร่วมคณะ ({myFacultyCount})</span>
                </div>
                <div style={styles.legendItem}>
                    <div style={{ ...styles.legendBox, backgroundColor: '#374151' }}></div>
                    <span>บุคคลอื่น ({otherCount})</span>
                </div>
            </div>
        </div>
    );
}
