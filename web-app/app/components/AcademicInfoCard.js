'use client';

import { CheckIcon, ClockIcon } from './Icons';
import InteractiveCard from './InteractiveCard';
import { motion } from 'framer-motion';
export default function AcademicInfoCard({ data, loading }) {
    if (loading) {
        return <AcademicSkeleton />;
    }

    if (!data) return null;

    // Boundary Rule: Accept either camelCase (from API) or snake_case (from legacy adapters).
    // Prefer camelCase — this is the standard for all new code.
    const currentYear = data.currentYear ?? data.currentacadyear ?? null;
    const currentSem = data.currentSemester ?? data.currentsemester ?? null;
    const enrollYear = data.enrollYear ?? data.enrollacadyear ?? null;
    const enrollSem = data.enrollSemester ?? data.enrollsemester ?? null;
    const admitYear = data.admitYear ?? data.admitacadyear ?? null;
    const admitSem = data.admitSemester ?? data.admitsemester ?? null;

    return (
        <InteractiveCard containerStyle={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '28px',
        }}>
            {/* Title */}
            <h3 style={{
                color: 'white', fontSize: '1rem', fontWeight: 600,
                margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
                </svg>
                ข้อมูลการศึกษา
            </h3>

            {/* Academic Info Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
            }}>
                <AcadItem
                    label="ปีการศึกษาปัจจุบัน"
                    value={`${currentYear || '—'}`}
                    sub={currentSem ? `ภาคเรียนที่ ${currentSem}` : null}
                    highlight
                />
                <AcadItem
                    label="ช่วงลงทะเบียน"
                    value={`${enrollYear || '—'}`}
                    sub={enrollSem ? `ภาคเรียนที่ ${enrollSem}` : null}
                />
                <AcadItem
                    label="ปีที่เข้าศึกษา"
                    value={`${admitYear || '—'}`}
                    sub={admitSem ? `ภาคเรียนที่ ${admitSem}` : null}
                />
                <AcadItem
                    label="สถานะลงทะเบียน"
                    value={enrollYear === currentYear
                        ? <span className="inline-flex items-center gap-1"><CheckIcon size={14} /> เปิดลงทะเบียน</span>
                        : <span className="inline-flex items-center gap-1"><ClockIcon size={14} /> รอเปิด</span>}
                    isStatus
                />
            </div>
        </InteractiveCard>
    );
}

function AcadItem({ label, value, sub, highlight, isStatus }) {
    return (
        <div
            className="relative overflow-hidden"
            style={{
                background: highlight ? 'rgba(255, 135, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '1px', // Space for the glowing border
            }}
        >


            <div style={{
                background: highlight ? 'rgba(30, 20, 10, 0.8)' : 'rgba(20, 25, 35, 0.8)',
                borderRadius: '11px',
                padding: '16px',
                height: '100%',
                position: 'relative',
                zIndex: 1
            }}>
                <div style={{
                    color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.72rem',
                    fontWeight: 500, marginBottom: '6px',
                }}>
                    {label}
                </div>
                <div style={{
                    color: highlight ? '#ff8700' : 'white',
                    fontSize: isStatus ? '0.85rem' : '1.2rem',
                    fontWeight: 600,
                    fontFamily: isStatus ? 'inherit' : 'Montserrat, sans-serif',
                }}>
                    {value}
                </div>
                {sub && (
                    <div style={{
                        color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem',
                        marginTop: '3px',
                    }}>
                        {sub}
                    </div>
                )}
            </div>
        </div>
    );
}

function AcademicSkeleton() {
    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '28px',
            animation: 'pulse 1.8s ease-in-out infinite',
        }}>
            <div style={{ height: 16, width: '35%', background: 'rgba(255,255,255,0.12)', borderRadius: 8, marginBottom: 18 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ height: 72, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} />
                ))}
            </div>
            <style jsx>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
        </div>
    );
}
