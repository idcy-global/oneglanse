type AnalysisPageCursor = {
	promptRunAt: string;
	id: string;
};

export function getNextAnalysisCursor(
	rows: readonly { prompt_run_at: string; id: string }[],
): AnalysisPageCursor | null {
	const last = rows.at(-1);
	if (!last?.prompt_run_at || !last.id) return null;
	return {
		promptRunAt: last.prompt_run_at,
		id: last.id,
	};
}
