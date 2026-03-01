import React from 'react';
import { clsx } from 'clsx';

type ButtonVariant =
	| 'primary'
	| 'default'
	| 'secondary'
	| 'outline'
	| 'success'
	| 'warning'
	| 'danger'
	| 'destructive'
	| 'ghost';
type ButtonSize = 'sm' | 'md' | 'xs' | 'lg';

/**
 * Accessible Button Props
 * Extends native button attributes with variant and size options.
 */
type ButtonProps = React.PropsWithChildren<{
	/** Additional CSS classes */
	className?: string;
	/** Visual variant */
	variant?: ButtonVariant;
	/** Button size - lg provides touch-friendly 44px target */
	size?: ButtonSize;
	/** Click handler */
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
	/** Button type attribute */
	type?: 'button' | 'submit' | 'reset';
	/** Disabled state */
	disabled?: boolean;
	/** Accessible label for icon-only buttons */
	'aria-label'?: string;
	/** Loading state - disables button and shows spinner */
	loading?: boolean;
}>;

const variantClasses: Record<ButtonVariant, string> = {
	primary: 'theme-bg-accent theme-text-on-accent shadow-lg shadow-[color:rgba(0,0,0,0.1)] hover:opacity-95',
	default: 'theme-bg-accent theme-text-on-accent shadow-lg shadow-[color:rgba(0,0,0,0.1)] hover:opacity-95',
	secondary: 'border theme-border theme-bg-secondary theme-text-primary hover:opacity-95',
	outline: 'border theme-border bg-transparent theme-text-primary hover:bg-[color:var(--color-background-secondary)]/60',
	success: 'theme-bg-success theme-text-on-accent hover:opacity-95',
	warning: 'theme-bg-warning theme-text-on-accent hover:opacity-95',
	danger: 'bg-red-600 text-white hover:bg-red-700',
	destructive: 'bg-red-600 text-white hover:bg-red-700',
	ghost: 'bg-transparent theme-text-primary hover:bg-[color:var(--color-background-secondary)]',
};

const sizeClasses: Record<ButtonSize, string> = {
	xs: 'px-2 py-1 text-xs min-h-[28px]',
	sm: 'px-3 py-1.5 text-sm min-h-[32px]',
	md: 'px-4 py-2 text-sm min-h-[36px]',
	lg: 'px-5 py-3 text-base min-h-[44px]', // WCAG 2.5.5 touch target
};

/**
 * Accessible Button Component
 * 
 * Features:
 * - Focus ring for keyboard navigation (WCAG 2.4.7)
 * - Touch-friendly size option (WCAG 2.5.5)
 * - Loading state with aria-busy
 * - Support for aria-label on icon-only buttons
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="lg">Submit</Button>
 * <Button aria-label="Close dialog" onClick={onClose}><XIcon /></Button>
 * ```
 */
export function Button({ 
	className, 
	variant = 'secondary', 
	size = 'md', 
	type = 'button', 
	loading,
	disabled,
	children,
	...rest 
}: ButtonProps) {
	const base =
		'inline-flex items-center justify-center rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
	
	const isDisabled = disabled || loading;
	
	return (
		<button
			type={type}
			className={clsx(base, variantClasses[variant], sizeClasses[size], className)}
			disabled={isDisabled}
			aria-busy={loading}
			{...rest}
		>
			{loading && (
				<svg 
					className="animate-spin -ml-1 mr-2 h-4 w-4" 
					fill="none" 
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
			)}
			{children}
		</button>
	);
}

