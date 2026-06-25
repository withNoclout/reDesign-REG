export const LOAN_SURFACE = 'rounded-[28px] border border-white/[0.16] bg-[rgba(255,255,255,0.08)] backdrop-blur-[20px] shadow-[0_24px_64px_rgba(15,23,42,0.22)]';
export const LOAN_SURFACE_SUBTLE = 'rounded-[24px] border border-white/[0.14] bg-[rgba(255,255,255,0.06)] backdrop-blur-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.16)]';
export const LOAN_SURFACE_EMBED = 'rounded-[22px] border border-white/[0.12] bg-[rgba(255,255,255,0.05)] backdrop-blur-[16px]';

export const LOAN_TONE_CLASSES = {
    emerald: 'border-emerald-400/20 bg-emerald-500/12 text-emerald-100',
    amber: 'border-amber-400/20 bg-amber-500/12 text-amber-100',
    sky: 'border-sky-400/20 bg-sky-500/12 text-sky-100',
    slate: 'border-white/10 bg-white/[0.05] text-white/80',
};

export function toneClass(tone) {
    return LOAN_TONE_CLASSES[tone] || LOAN_TONE_CLASSES.slate;
}
