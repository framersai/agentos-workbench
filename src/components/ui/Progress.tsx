type ProgressProps = {
	value: number; // 0..100
	className?: string;
};

export function Progress({ value, className }: ProgressProps) {
	const v = Math.max(0, Math.min(100, Math.floor(value ?? 0)));
	return (
		<div className={`h-3 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-800 ${className ?? ''}`}>
			<div className="h-full bg-sky-500 transition-all" style={{ width: `${v}%` }} />
		</div>
	);
}


