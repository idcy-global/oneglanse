import { clickhouse } from "@oneglanse/db";
import { DatabaseError, toErrorMessage } from "@oneglanse/errors";

type InsertFallbackOptions<T extends Record<string, unknown>> = {
	throwOnAllFailed?: boolean;
	onRecordFailed?: (value: T, err: unknown) => void;
};

export type ClickHouseInsertResult = {
	attemptedCount: number;
	savedCount: number;
	failedCount: number;
};

// Shared batch-insert pattern: attempts a batch insert first, then falls back
// to one-by-one inserts to salvage partial writes when possible.
export async function insertClickHouseWithFallback<
	T extends Record<string, unknown>,
>(
	table: string,
	values: T[],
	opts: InsertFallbackOptions<T> = {},
): Promise<ClickHouseInsertResult> {
	const { throwOnAllFailed = false, onRecordFailed } = opts;

	try {
		await clickhouse.insert({ table, values, format: "JSONEachRow" });
		return {
			attemptedCount: values.length,
			savedCount: values.length,
			failedCount: 0,
		};
	} catch (batchErr) {
		console.error(
			`⚠️ ClickHouse batch insert failed for ${table}:`,
			toErrorMessage(batchErr),
		);

		let successCount = 0;
		let failedCount = 0;
		for (const value of values) {
			try {
				await clickhouse.insert({
					table,
					values: [value],
					format: "JSONEachRow",
				});
				successCount++;
			} catch (individualErr) {
				failedCount++;
				onRecordFailed?.(value, individualErr);
			}
		}

		console.warn(`${table}: ${successCount}/${values.length} records saved`);

		if (successCount === 0) {
			if (throwOnAllFailed) {
				throw new DatabaseError(`Failed to insert all records into ${table}`, {
					table,
					operation: "insert",
					count: values.length,
				});
			}
			console.error(
				`❌ All inserts failed for ${table}, but job will continue`,
			);
		}

		return {
			attemptedCount: values.length,
			savedCount: successCount,
			failedCount,
		};
	}
}
