import { forwardRef } from 'react';

const VARIANTS = {
  primary: 'bg-primary text-bg border-primary hover:bg-ink hover:border-ink',
  secondary: 'bg-transparent text-primary border-control hover:border-primary hover:bg-primary/10',
  ghost: 'bg-transparent text-body border-transparent hover:text-primary hover:border-border',
  danger: 'bg-transparent text-secondary border-secondary hover:bg-secondary/10',
};
const SIZES = {
  sm: 'h-8 px-3 text-[0.6875rem]',
  md: 'h-10 px-4 text-xs',
  lg: 'h-12 px-6 text-sm',
};

/**
 * @param {{variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md'|'lg',
 *   loading?: boolean} & import('react').ButtonHTMLAttributes<HTMLButtonElement>} props
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 border font-mono font-medium uppercase tracking-[0.12em] transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <span className="h-3 w-3 animate-spin border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
