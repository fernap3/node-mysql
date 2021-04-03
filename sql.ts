import * as mysql from "mysql"

var pool = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
	connectionLimit: 10,
	typeCast: (field, defaultCastFn) =>
	{
		// Make single-bit fields represented as true/false in javascript
		if (field.type === "BIT" && field.length === 1)
		{
			const buf = field.buffer();
			return buf == null ? null : buf[0] === 1;
		}

		// Parse JSON fields into native objects rather than leaving them as strings
		if (field.type === "JSON")
		{
			const str = field.string();
			return str == null ? null : JSON.parse(str);
		}

		return defaultCastFn();
	}
});

export async function getConnection()
{
	return new Promise<mysql.PoolConnection>((resolve, reject) =>
	{
		pool.getConnection((err, connection) => {
			if (err) throw err;
			resolve(connection);
		});
	});
}

export async function closePool()
{
	return new Promise<void>((resolve, reject) =>
	{
		pool.end((err) => {
			if (err) throw err;
			resolve();
		});
	});
}

interface DoQueryResult<T> extends Array<T>
{
	affectedRows: number;
	changedRows: number;
	insertId: number;
}

export async function doQuery<T>(query: ParameterizedQuery, connection?: mysql.Connection): Promise<DoQueryResult<T>>
export async function doQuery<T>(query: string, queryParams?: any[], connection?: mysql.Connection): Promise<DoQueryResult<T>>
export async function doQuery<T>(query: string | ParameterizedQuery, queryParamsOrConnection?: any[] | mysql.Connection, connection?: mysql.Connection): Promise<DoQueryResult<T>>
{
	const queryString = typeof query === "string" ? query : query.queryText;
	const parameters = typeof query === "string" ? queryParamsOrConnection as any[] : query.parameters;
	
	return new Promise<DoQueryResult<T>>((resolve, reject) =>
	{
		if (connection)
		{
			const queryStart = process.hrtime();
			connection.query(queryString, parameters, (err, rows) =>
			{
				if (process.env.LOG_SQL)
				{
					const queryTime = process.hrtime(queryStart);
					console.log(`Query took ${(queryTime[0] * 1000) + (queryTime[1] / 1e6)}ms: ${query}`);
				}

				if (err) throw err;
				resolve(rows);
			});
		}
		else
		{
			pool.getConnection((err, conn) => {
				if (err) throw err;

				const queryStart = process.hrtime();
				conn.query(queryString, parameters, (err, rows) =>
				{
					if (process.env.LOG_SQL)
					{
						const queryTime = process.hrtime(queryStart);
						console.log(`Query took ${(queryTime[0] * 1000) + (queryTime[1] / 1e6)}ms: ${query}`);
					}

					conn.release();
					if (err) throw err;
					resolve(rows);
				});
			});
		}
	});
}

export function sql(strings: TemplateStringsArray, ...exp: any[]): ParameterizedQuery
{
	return {
		queryText: strings.join("?"),
		parameters: exp,
	} as ParameterizedQuery;
}

export interface ParameterizedQuery
{
	queryText: string;
	parameters: any[];
}

function bitToBool(bitRecord: any)
{
	return bitRecord[0] === 1;
}

module.exports = {
	doQuery: doQuery,
	getConnection: getConnection,
	bitToBool: bitToBool,
	closePool: closePool,
	sql: sql,
};
