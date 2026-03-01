import React from 'react';

type BadgeVariant =
	| 'primary'
	| 'default'
	| 'secondary'
	| 'outline'
	| 'success'
	| 'warning'
	| 'danger'
	| 'destructive'
	| 'accent';
type BadgeSize = 'sm' | 'xs';

type BadgeProps = React.PropsWithChildren<{
	className?: string;
	variant?: BadgeVariant;
	size?: BadgeSize;
	title?: string;
}>;

const variantClasses: Record<BadgeVariant, string> = {
	primary: 'bg-sky-600 text-white',
	default: 'bg-sky-600 text-white',
	secondary: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
	outline: 'border border-slate-300 bg-transparent text-slate-700 dark:border-white/10 dark:text-slate-200',
	success: 'bg-emerald-600 text-white',
	warning: 'bg-amber-500 text-white',
	danger: 'bg-red-600 text-white',
	destructive: 'bg-red-600 text-white',
	accent: 'theme-bg-accent theme-text-on-accent',
};

const sizeClasses: Record<BadgeSize, string> = {
	xs: 'px-1.5 py-0.5 text-[10px] rounded',
	sm: 'px-2 py-0.5 text-xs rounded',
};

export function Badge({ className, variant = 'secondary', size = 'sm', title, children }: BadgeProps) {
	return <span className={`${variantClasses[variant]} ${sizeClasses[size]} ${className ?? ''}`} title={title}>{children}</span>;
}

