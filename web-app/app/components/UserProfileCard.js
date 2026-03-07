'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { GraduationCapIcon, CalendarIcon, BuildingIcon, CogIcon, IdCardIcon, MailIcon, BookOpenIcon, BookIcon, UserCheckIcon } from './Icons';
import OtpVerifyModal from './OtpVerifyModal';
import ProfileUploadModal from './ProfileUploadModal';


export default function UserProfileCard({ user, loading, profileData }) {
    const { updateProfileImage, logout } = useAuth();

    // State declarations
    const [isHovered, setIsHovered] = useState(false);
    const [extraInfo, setExtraInfo] = useState(profileData || null);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncProfile = async (e) => {
        if (e) e.stopPropagation();
        setIsSyncing(true);
        try {
            const res = await fetch('/api/student/profile/sync', { method: 'POST' });
            if (res.status === 401) {
                if (logout) logout();
                return;
            }
            const data = await res.json();
            if (data && data.success) {
                setExtraInfo(data.data);
            } else {
                alert(data.message || 'ซิงค์ข้อมูลไม่สำเร็จ');
            }
        } catch (err) {
            console.error('Failed to sync profile', err);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleOtpVerified = () => {
        setShowOtpModal(false);
        // Refresh check or logic could go here
    };

    // Update extraInfo if profileData prop changes
    useEffect(() => {
        if (profileData) {
            setExtraInfo(profileData);
        }
    }, [profileData]);

    // Fetch only if no profileData was provided by parent (standalone usage)
    // Skip when loading=true (parent is actively fetching)
    useEffect(() => {
        if (user && !profileData && !extraInfo && !loading) {
            fetch('/api/student/profile')
                .then(async res => {
                    if (res.status === 401) {
                        if (logout) logout();
                        return null;
                    }
                    return res.json();
                })
                .then(data => {
                    if (data?.success) setExtraInfo(data.data);
                })
                .catch(err => console.error('[UserProfileCard] Failed to fetch profile:', err));
        }
    }, [user, logout, loading]);

    if (loading) {
        return <UserProfileSkeleton />;
    }

    if (!user) return null;

    const statusColor = user.userstatus === 'Y' ? '#4ade80' : '#f87171';
    const statusBg = user.userstatus === 'Y' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)';

    // Check if a custom profile image (Supabase URL or uploaded)
    const isCustomImage = user.img && (user.img.startsWith('https://') || user.img.startsWith('data:'));

    // Display image: custom Supabase image > university original > null (shows letter avatar)
    const displayImg = user.img || user.originalImg || null;

    const handleReset = (e) => {
        e.stopPropagation();
        if (confirm('Revert to original student photo?')) {
            updateProfileImage(null);
        }
    };

    const handleProfileClick = () => {
        setShowUploadModal(true);
    };

    const handleCropSave = (dataUrl) => {
        updateProfileImage(dataUrl);
        setShowUploadModal(false);
    };

    return (
        <div className="profile-card" style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
        }}>
            {/* Header: Photo + Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                {/* Profile Image Container */}
                <div
                    style={{
                        position: 'relative',
                        width: '72px',
                        height: '72px',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={handleProfileClick}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleProfileClick(); } }}
                    role="button"
                    tabIndex={0}
                    aria-label="เปลี่ยนรูปโปรไฟล์"
                >
                    <div style={{
                        width: '100%', height: '100%',
                        borderRadius: '50%', overflow: 'hidden',
                        border: '3px solid rgba(255, 255, 255, 0.3)',
                        flexShrink: 0,
                        background: 'rgba(255, 255, 255, 0.1)',
                        position: 'relative',
                    }}>
                        {displayImg ? (
                            <img
                                src={displayImg}
                                alt={user.name || 'Profile'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        ) : (
                            <div style={{
                                width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'rgba(255, 255, 255, 0.5)', fontSize: '28px', fontWeight: 600,
                            }}>
                                {(user.usernameeng || user.username || '?').charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Hover Overlay */}
                    {isHovered && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', flexDirection: 'column', gap: '4px',
                            backdropFilter: 'blur(2px)',
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                            </svg>
                            <span style={{ fontSize: '10px', fontWeight: 600 }}>แก้ไข</span>
                        </div>
                    )}
                </div>

                {/* Name & Code */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{
                                color: 'white', fontSize: '1.15rem', fontWeight: 600,
                                margin: 0, lineHeight: 1.3,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {user.name || user.username || 'N/A'}
                            </h2>
                            <p style={{
                                color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.85rem',
                                margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif',
                            }}>
                                {user.nameeng || user.usernameeng || ''}
                            </p>
                        </div>

                        {/* Reset Button (only if custom image) */}
                        {isCustomImage && (
                            <button
                                onClick={handleReset}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none', borderRadius: '4px',
                                    color: 'rgba(255,255,255,0.75)',
                                    fontSize: '10px', padding: '2px 6px',
                                    cursor: 'pointer', marginLeft: '8px'
                                }}
                                aria-label="Reset to original profile photo"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Status Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        {/* Status Badge */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            background: statusBg, borderRadius: '20px',
                            padding: '3px 10px',
                        }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor }} />
                            <span style={{ color: statusColor, fontSize: '0.75rem', fontWeight: 500 }}>
                                {user.statusdes || user.userstatusdes || 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
            }}>
                <InfoItem icon={<IdCardIcon size={14} />} label="รหัสนักศึกษา" value={user.usercode} mono />
                <InfoItem icon={<MailIcon size={14} />} label="อีเมล" value={user.email} />
                <InfoItem icon={<GraduationCapIcon size={14} />} label="บทบาท" value={formatRole(user.role)} />
                <InfoItem icon={<CalendarIcon size={14} />} label="วันรายงานตัว" value={formatDate(user.reportdate)} />
            </div>

            {/* Extra Student Profile Data */}
            <div style={{
                marginTop: '0px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h3 style={{
                        color: 'white', fontSize: '0.95rem', fontWeight: 600, margin: 0,
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <span style={{ opacity: 0.7 }}><BookOpenIcon size={16} /></span> ข้อมูลทางวิชาการ
                    </h3>

                    <button
                        onClick={handleSyncProfile}
                        disabled={isSyncing}
                        aria-label="Refresh Profile Data"
                        style={{
                            background: isSyncing ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '6px',
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: '0.7rem',
                            padding: '3px 8px',
                            cursor: isSyncing ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                        }}
                    >
                        <span style={{
                            display: 'inline-block',
                            transform: isSyncing ? 'rotate(360deg)' : 'none',
                            transition: isSyncing ? 'transform 1s linear infinite' : 'none',
                            fontSize: '0.85rem'
                        }}>↻</span>
                        {isSyncing ? 'กำลังซิงค์...' : 'อัปเดตข้อมูล'}
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                    <InfoItem icon={<BuildingIcon size={14} />} label="คณะ" value={extraInfo?.faculty} />
                    <InfoItem icon={<CogIcon size={14} />} label="ภาควิชา" value={extraInfo?.department} />
                    <InfoItem icon={<BookIcon size={14} />} label="หลักสูตร" value={extraInfo?.major} />
                </div>

                {/* Always show Advisor section */}
                <>
                    <h3 style={{
                        color: 'white', fontSize: '0.95rem', fontWeight: 600, margin: '8px 0 0',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <span style={{ opacity: 0.7 }}><UserCheckIcon size={16} /></span> อาจารย์ที่ปรึกษา
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Always show Advisor 1 slot, even if empty */}
                        <AdvisorItem name={extraInfo?.advisor1 || '—'} index={1} />

                        {/* Show Advisor 2 & 3 only if they exist (to avoid clutter), OR if user specifically wants 3 slots? 
                            User said "Advisor 1, 2, 3". I will show them if they are non-null OR if they are the requested fields.
                            Let's show Advisor 2 and 3 if they have data. If the user wants 3 empty slots, they can ask.
                            But usually Advisor 2/3 are rare. 
                            Wait, "If cannot fetch... show dash". This implies "If I expect to see it but it's not there".
                            If the student HAS 2 advisors but API fails, we don't know they have 2. 
                            So we can only show Dash for Advisor 1 safe bet. 
                        */}
                        {extraInfo?.advisor2 && <AdvisorItem name={extraInfo.advisor2} index={2} />}
                        {extraInfo?.advisor3 && <AdvisorItem name={extraInfo.advisor3} index={3} />}
                    </div>
                </>
            </div>

            {/* OTP Modal Overlay using OtpVerifyModal component */}
            <OtpVerifyModal
                isOpen={showOtpModal}
                email={user.email}
                usercode={user.usercode}
                userName={user.name || user.username}
                onVerified={handleOtpVerified}
                onClose={() => setShowOtpModal(false)}
            />

            {/* Profile Upload & Crop Modal */}
            <ProfileUploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onSave={handleCropSave}
            />
        </div>
    );
}

function AdvisorItem({ name, index }) {
    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        }}>
            <div style={{
                width: '24px', height: '24px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', color: 'rgba(255,255,255,0.6)',
                fontWeight: 600
            }}>
                {index}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>
                {name}
            </div>
        </div>
    );
}

function InfoItem({ icon, label, value, mono }) {
    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '12px',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                marginBottom: '4px',
            }}>
                <span style={{ fontSize: '14px' }}>{icon}</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.72rem', fontWeight: 500 }}>
                    {label}
                </span>
            </div>
            <div style={{
                color: 'white', fontSize: '0.85rem', fontWeight: 500,
                fontFamily: mono ? 'Montserrat, monospace' : 'inherit',
                wordBreak: 'break-word',
                lineHeight: 1.4
            }}>
                {value || '—'}
            </div>
        </div>
    );
}

function UserProfileSkeleton() {
    return (
        <div className="relative p-7 rounded-[20px] border border-white/12 bg-white/8 backdrop-blur-[20px] animate-pulse">
            <div className="flex items-center gap-[18px] mb-5">
                <div className="w-[72px] h-[72px] rounded-full bg-white/12" />
                <div className="flex-1">
                    <div className="h-4 w-3/5 bg-white/12 rounded-lg mb-2" />
                    <div className="h-3 w-2/5 bg-white/8 rounded-md" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-[60px] bg-white/6 rounded-xl" />
                ))}
            </div>
            <div className="h-4 w-1/3 bg-white/12 rounded-lg mb-4" />
            <div className="flex flex-col gap-3">
                <div className="h-10 bg-white/6 rounded-xl" />
                <div className="h-10 bg-white/6 rounded-xl" />
            </div>
        </div>
    );
}

function formatRole(roles) {
    if (!roles || !Array.isArray(roles)) return '—';
    const roleMap = {
        student: 'นักศึกษา',
        instructor: 'อาจารย์',
        staff: 'เจ้าหน้าที่',
        executive: 'ผู้บริหาร',
    };
    return roles
        .filter(r => r && r.trim())
        .map(r => roleMap[r] || r)
        .join(', ') || '—';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    } catch {
        return dateStr;
    }
}
