/**
 * SVG Line Icons — stroke-only, no fill, professional look.
 * Replaces all Unicode emojis in the UI for cross-platform consistency.
 */

const defaultProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};

function Icon({ children, size, className, ...props }) {
    const merged = { ...defaultProps, ...props };
    if (size) { merged.width = size; merged.height = size; }
    return (
        <svg className={className} {...merged}>
            {children}
        </svg>
    );
}

export function LockIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </Icon>
    );
}

export function AlertTriangleIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </Icon>
    );
}

export function UserIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </Icon>
    );
}

export function UsersIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Icon>
    );
}

export function LightbulbIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
        </Icon>
    );
}

export function EyeIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </Icon>
    );
}

export function TagIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
        </Icon>
    );
}

export function FileTextIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </Icon>
    );
}

export function SparklesIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
            <path d="M18 15l.75 2.25L21 18l-2.25.75L18 21l-.75-2.25L15 18l2.25-.75L18 15z" />
        </Icon>
    );
}

export function LinkIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </Icon>
    );
}

export function GraduationCapIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
        </Icon>
    );
}

export function CalendarIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </Icon>
    );
}

export function BuildingIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="9" y1="22" x2="9" y2="18" />
            <line x1="15" y1="22" x2="15" y2="18" />
            <line x1="9" y1="6" x2="9" y2="6.01" />
            <line x1="15" y1="6" x2="15" y2="6.01" />
            <line x1="9" y1="10" x2="9" y2="10.01" />
            <line x1="15" y1="10" x2="15" y2="10.01" />
            <line x1="9" y1="14" x2="9" y2="14.01" />
            <line x1="15" y1="14" x2="15" y2="14.01" />
        </Icon>
    );
}

export function CogIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </Icon>
    );
}

export function CameraIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
        </Icon>
    );
}

export function HeartIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </Icon>
    );
}

export function HomeIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </Icon>
    );
}

export function CheckIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <polyline points="20 6 9 17 4 12" />
        </Icon>
    );
}

export function ClockIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </Icon>
    );
}

export function ShieldIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </Icon>
    );
}

export function IdCardIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <line x1="6" y1="14" x2="10" y2="14" />
            <line x1="14" y1="14" x2="18" y2="14" />
        </Icon>
    );
}

export function MailIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
        </Icon>
    );
}

export function BookOpenIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </Icon>
    );
}

export function BookIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </Icon>
    );
}

export function UserCheckIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <polyline points="17 11 19 13 23 9" />
        </Icon>
    );
}

export function RefreshCwIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </Icon>
    );
}

export function ZapIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </Icon>
    );
}

export function BombIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <circle cx="11" cy="13" r="9" />
            <path d="M14.35 4.65L16.5 2.5" />
            <path d="M15.5 2.5L17.5 4.5" />
        </Icon>
    );
}

export function GridIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
        </Icon>
    );
}

export function ListIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
        </Icon>
    );
}

export function ArrowUpIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
        </Icon>
    );
}

export function ArrowDownIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
        </Icon>
    );
}

export function XIcon({ size, className, ...props }) {
    return (
        <Icon size={size} className={className} {...props}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </Icon>
    );
}
