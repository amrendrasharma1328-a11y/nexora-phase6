const TONES = {
  green: 'border-primary text-primary',
  cyan: 'border-cyan text-cyan',
  magenta: 'border-secondary text-secondary',
  neutral: 'border-control text-body',
};

/** @param {{tone?: keyof typeof TONES, className?: string, children: import('react').ReactNode}} props */
export default function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
