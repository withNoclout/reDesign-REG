'use client';

/**
 * ToggleSwitch - iOS-style toggle switch for permissions
 * 
 * @param {Object} props
 * @param {boolean} props.enabled - Current state
 * @param {Function} props.onChange - Callback when toggled
 * @param {string} props.label - Label text
 */
export default function ToggleSwitch({ enabled, onChange, label }) {
    return (
        <div className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
            <span className="text-white font-medium">{label}</span>
            <button
                onClick={() => onChange(!enabled)}
                className={`relative w-14 h-8 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#4ade80] focus:ring-offset-2 focus:ring-offset-transparent ${enabled ? 'bg-[#4ade80]' : 'bg-white/20'
                    }`}
                aria-pressed={enabled}
                aria-label={`Toggle ${label}`}
            >
                <span
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg transition-transform duration-300 ${enabled ? 'translate-x-7' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    );
}