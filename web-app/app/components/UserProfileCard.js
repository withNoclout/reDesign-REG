'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function UserProfileCard({ user, loading }) {
    const { updateProfileImage, isVerified, connectGoogleDrive } = useAuth();
    const fileInputRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [extraInfo, setExtraInfo] = useState(null);

    useEffect(() => {
        if (user) {
            // Fetch extra profile data
            fetch('/api/student/profile')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setExtraInfo(data.data);
                    }
                })
                .catch(err => console.error('Failed to fetch student profile:', err));
        }
    }, [user]);

    if (loading) {
        return <UserProfileSkeleton />;
    }

    if (!user) return null;

    const statusColor = user.userstatus === 'Y' ? '#4ade80' : '#f87171';
    const statusBg = user.userstatus === 'Y' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)';

    // Check if current image is custom
    const isCustomImage = user.img?.startsWith('data:') || user.img?.startsWith('/uploads/');

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('File too large (max 5MB)');
            return;
        }

        setUploading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 500;

                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                updateProfileImage(dataUrl);
                setUploading(false);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleReset = (e) => {
        e.stopPropagation();
        if (confirm('Revert to original student photo?')) {
            updateProfileImage(null);
        }
    };

    const handleVerify = async () => {
        if (isVerified) return;
        setVerifying(true);
        const success = await connectGoogleDrive();
        setVerifying(false);
        if (success) {
            alert('Google Drive connected! You can now change your profile picture.');
        }
    };

    const handleProfileClick = () => {
        if (!isVerified) {
            alert('Please verify your account (connect Google Drive) to change your profile picture.');
            return;
        }
        fileInputRef.current?.click();
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
                        cursor: isVerified ? 'pointer' : 'not-allowed',
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={handleProfileClick}
                >
                    <div style={{
                        width: '100%', height: '100%',
                        borderRadius: '50%', overflow: 'hidden',
                        border: '3px solid rgba(255, 255, 255, 0.3)',
                        flexShrink: 0,
                        background: 'rgba(255, 255, 255, 0.1)',
                        position: 'relative',
                    }}>
                        {user.img ? (
                            <img
                                src={user.img}
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
                    {(isHovered || uploading) && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '10px', flexDirection: 'column',
                            backdropFilter: 'blur(2px)',
                        }}>
                            {uploading ? '...' : (isVerified ? 'Edit' : 'Locked')}
                        </div>
                    )}

                    {/* Hidden Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleFileChange}
                    />
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
                                color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem',
                                margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif',
                            }}>
                                {user.nameeng || user.usernameeng || ''}
                            </p>
                        </div>

                        {/* Reset Button (only if custom image and verified) */}
                        {isCustomImage && isVerified && (
                            <button
                                onClick={handleReset}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none', borderRadius: '4px',
                                    color: 'rgba(255,255,255,0.6)',
                                    fontSize: '10px', padding: '2px 6px',
                                    cursor: 'pointer', marginLeft: '8px'
                                }}
                                title="Reset to original photo"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Status + Verify Row */}
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

                        {/* Verify Badge/Button */}
                        <button
                            onClick={handleVerify}
                            disabled={isVerified || verifying}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                background: isVerified ? 'rgba(74, 222, 128, 0.15)' : 'rgba(250, 204, 21, 0.15)',
                                borderRadius: '20px', padding: '3px 10px',
                                border: 'none',
                                cursor: isVerified ? 'default' : 'pointer',
                                transition: 'all 0.2s',
                            }}
                            title={isVerified ? 'Verified (Google Drive Connected)' : 'Click to Verify and Connect Drive'}
                        >
                            <span style={{ fontSize: '12px' }}>
                                {isVerified ? '✓' : (verifying ? '...' : '⚠')}
                            </span>
                            <span style={{
                                color: isVerified ? '#4ade80' : '#facc15',
                                fontSize: '0.75rem', fontWeight: 500,
                            }}>
                                {isVerified ? 'Verified' : 'Verify'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
            }}>
                <InfoItem icon="🆔" label="รหัสนักศึกษา" value={user.usercode} mono />
                <InfoItem icon="📧" label="อีเมล" value={user.email} />
                <InfoItem icon="🎓" label="บทบาท" value={formatRole(user.role)} />
                <InfoItem icon="📅" label="วันรายงานตัว" value={formatDate(user.reportdate)} />
            </div>

            {/* Extra Student Profile Data */}
            {extraInfo && (
                <div style={{
                    marginTop: '0px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    paddingTop: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <h3 style={{
                        color: 'white', fontSize: '0.95rem', fontWeight: 600, margin: 0,
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <span style={{ opacity: 0.7 }}>📚</span> ข้อมูลทางวิชาการ
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                        <InfoItem icon="🏛️" label="คณะ" value={extraInfo.faculty} />
                        <InfoItem icon="⚙️" label="ภาควิชา" value={extraInfo.department} />
                        <InfoItem icon="📖" label="หลักสูตร" value={extraInfo.major} />
                    </div>

                    {(extraInfo.advisor1 || extraInfo.advisor2) && (
                        <>
                            <h3 style={{
                                color: 'white', fontSize: '0.95rem', fontWeight: 600, margin: '8px 0 0',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <span style={{ opacity: 0.7 }}>👨‍🏫</span> อาจารย์ที่ปรึกษา
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {extraInfo.advisor1 && <AdvisorItem name={extraInfo.advisor1} index={1} />}
                                {extraInfo.advisor2 && <AdvisorItem name={extraInfo.advisor2} index={2} />}
                                {extraInfo.advisor3 && <AdvisorItem name={extraInfo.advisor3} index={3} />}
                            </div>
                        </>
                    )}
                </div>
            )}
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
