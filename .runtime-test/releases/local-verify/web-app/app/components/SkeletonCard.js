'use client';

export default function SkeletonCard({ lines = 3, height = '200px' }) {
    return (
        <div
            className="skeleton-card relative p-6 rounded-2xl border border-white/12 bg-white/8 backdrop-blur-md animate-pulse"
            style={{ height }}
        >
            {/* Header skeleton */}
            <div className="h-3.5 bg-white/12 rounded-lg w-2/5 mb-5" />

            {/* Line skeletons */}
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className="h-3 bg-white/8 rounded-md mb-3"
                    style={{ width: `${65 + (i * 10) % 30}%` }} // Deterministic width
                />
            ))}
        </div>
    );
}
