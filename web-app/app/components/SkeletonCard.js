'use client';

export default function SkeletonCard({ lines = 3, height = '200px' }) {
    return (
        <div className="skeleton-card" style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '24px',
            height,
            animation: 'pulse 1.8s ease-in-out infinite',
        }}>
            {/* Header skeleton */}
            <div style={{
                height: '14px',
                background: 'rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                width: '40%',
                marginBottom: '20px',
            }} />
            {/* Line skeletons */}
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} style={{
                    height: '12px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    width: `${65 + Math.random() * 30}%`,
                    marginBottom: '12px',
                }} />
            ))}
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
