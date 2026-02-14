'use client';

export default function UserProfileCard({ user, loading }) {
    if (loading) {
        return <UserProfileSkeleton />;
    }

    if (!user) return null;

    const statusColor = user.userstatus === 'Y' ? '#4ade80' : '#f87171';
    const statusBg = user.userstatus === 'Y' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)';

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
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
            }}>
                {/* Profile Image */}
                <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '3px solid rgba(255, 255, 255, 0.3)',
                    flexShrink: 0,
                    background: 'rgba(255, 255, 255, 0.1)',
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

                {/* Name & Code */}
                <div style={{ flex: 1, minWidth: 0 }}>
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
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: statusBg, borderRadius: '20px',
                        padding: '3px 10px', marginTop: '6px',
                    }}>
                        <span style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            background: statusColor,
                        }} />
                        <span style={{ color: statusColor, fontSize: '0.75rem', fontWeight: 500 }}>
                            {user.statusdes || user.userstatusdes || 'N/A'}
                        </span>
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
                wordBreak: 'break-all',
            }}>
                {value || '—'}
            </div>
        </div>
    );
}

function UserProfileSkeleton() {
    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '28px',
            animation: 'pulse 1.8s ease-in-out infinite',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '20px' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
                <div style={{ flex: 1 }}>
                    <div style={{ height: 16, width: '60%', background: 'rgba(255,255,255,0.12)', borderRadius: 8, marginBottom: 8 }} />
                    <div style={{ height: 12, width: '40%', background: 'rgba(255,255,255,0.08)', borderRadius: 6 }} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ height: 60, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} />
                ))}
            </div>
            <style jsx>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
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
