import * as mysql from "mysql"

var pool = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
	timezone: "Z",
	connectionLimit: 10,
	typeCast: (field, defaultCastFn) =>
	{
		// Make single-bit fields represented as true/false in javascript
		if (field.type === "BIT" && field.length === 1)
			return field.buffer()[0] === 1;

		// Parse JSON fields into native objects rather than leaving them as strings
		if (field.type === "JSON")
			return JSON.parse(field.string());

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
	return new Promise((resolve, reject) =>
	{
		pool.end((err) => {
			if (err) throw err;
			resolve();
		});
	});
}

export async function doQuery<T>(query: string, queryParams?: any[], connection?: mysql.Connection): Promise<T[]>
{
	return new Promise<T[]>((resolve, reject) =>
	{
		if (connection)
		{
			const queryStart = process.hrtime();
			connection.query(query, queryParams, (err, rows) =>
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
				conn.query(query, queryParams, (err, rows) =>
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

function bitToBool(bitRecord: any)
{
	return bitRecord[0] === 1;
}

module.exports = {
	doQuery: doQuery,
	getConnection: getConnection,
	bitToBool: bitToBool,
	closePool: closePool
};

export type EVNetwork = "greenlots" | "chargepoint" | "semacharge" | "opconnect" | "tesla" | "evconnect" | "aerovironment" | "gewattstation" | "evgo" | "blink" | "electrifyamerica";

export interface StationQueryRow
{
	StationId: string;
	DeviceIds: string[];
	Name: string;
	Subname?: string;
	NetworkId: EVNetwork;
	City: string;
	State: string;
	StreetAddress: string;
	Latitude: number;
	Longitude: number;
}

export interface StationStatusQueryRow
{
	UserStationId: string;
	StationId: string;
	Name: string;
	Subname?: string;
	NetworkId: EVNetwork;
	Nickname: string;
	DeviceIds: string[];
	LocaleId: string;
	LocaleNickname: string;
}

export interface UserLocaleQueryRow
{
	UserLocaleId: string;
	UserId: string;
	Nickname: string;
	Latitude: number;
	Longitude: number;
}

export interface ChargeSuggestionQueryRow
{
	StationId: string;
	NetworkId: EVNetwork;
	DeviceIds: string[];
	UserStationId: string;
	Name: string;
	Subname?: string;
	Nickname: string;
}

export interface UserQueryRow
{
	UserId: string;
	FirstName: string;
	LastName: string;
	Email: string;
	PasswordSalt: string;
	PasswordHash: string;
}