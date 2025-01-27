import { EntityRepository, Repository } from 'typeorm';
import NodeMeasurementDayV2 from '../entities/NodeMeasurementDayV2';
import NodePublicKeyStorage from '../entities/NodePublicKeyStorage';
import {
	NodeMeasurementV2AverageRecord,
	NodeMeasurementV2Average
} from './NodeMeasurementV2Repository';
import { injectable } from 'inversify';

export interface IMeasurementRollupRepository {
	rollup(fromCrawlId: number, toCrawlId: number): void;
}

export interface NodeMeasurementV2StatisticsRecord {
	time: string;
	isActiveCount: string;
	isValidatingCount: string;
	isFullValidatorCount: string;
	isOverloadedCount: string;
	indexSum: string;
	crawlCount: string;
}

export class NodeMeasurementV2Statistics {
	time: Date;
	isActiveCount: number;
	isValidatingCount: number;
	isFullValidatorCount: number;
	isOverloadedCount: number;
	indexSum: number;
	crawlCount: number;

	constructor(
		day: Date,
		isActiveCount: number,
		isValidatingCount: number,
		isFullValidatorCount: number,
		isOverloadedCount: number,
		indexSum: number,
		crawlCount: number
	) {
		this.time = day;
		this.isActiveCount = isActiveCount;
		this.isValidatingCount = isValidatingCount;
		this.isFullValidatorCount = isFullValidatorCount;
		this.isOverloadedCount = isOverloadedCount;
		this.indexSum = indexSum;
		this.crawlCount = crawlCount;
	}

	static fromDatabaseRecord(record: NodeMeasurementV2StatisticsRecord) {
		return new this(
			new Date(record.time),
			Number(record.isActiveCount),
			Number(record.isValidatingCount),
			Number(record.isFullValidatorCount),
			Number(record.isOverloadedCount),
			Number(record.indexSum),
			Number(record.crawlCount)
		);
	}

	toString() {
		return `NodeMeasurementV2Average (day: ${this.time}, activeCount: ${this.isActiveCount}, isValidatingCount: ${this.isValidatingCount}, isFullValidatorCount: ${this.isFullValidatorCount}, isOverLoadedCount: ${this.isOverloadedCount}, indexSum: ${this.indexSum}, crawlCount: ${this.crawlCount})`;
	}
}

@injectable()
@EntityRepository(NodeMeasurementDayV2)
export class NodeMeasurementDayV2Repository
	extends Repository<NodeMeasurementDayV2>
	implements IMeasurementRollupRepository
{
	async findXDaysAverageAt(
		at: Date,
		xDays: number
	): Promise<NodeMeasurementV2Average[]> {
		const from = new Date(at.getTime());
		from.setDate(at.getDate() - xDays);

		const result = await this.query(
			`select "nodePublicKeyStorageId"                                                     as "nodeStoragePublicKeyId",
                    ROUND(100.0 * (sum("isActiveCount"::decimal) / sum("crawlCount")), 2)        as "activeAvg",
                    ROUND(100.0 * (sum("isValidatingCount"::decimal) / sum("crawlCount")), 2)    as "validatingAvg",
                    ROUND(100.0 * (sum("isFullValidatorCount"::decimal) / sum("crawlCount")), 2) as "fullValidatorAvg",
                    ROUND(100.0 * (sum("isOverloadedCount"::decimal) / sum("crawlCount")), 2)    as "overLoadedAvg",
                    ROUND((sum("indexSum"::decimal) / sum("crawlCount")), 2)                     as "indexAvg"
             FROM "node_measurement_day_v2" "NodeMeasurementDay"
             WHERE time >= date_trunc('day', $1::TIMESTAMP)
               and time <= date_trunc('day', $2::TIMESTAMP)
             GROUP BY "nodePublicKeyStorageId"
             having count("nodePublicKeyStorageId") >= $3`, //needs at least a record every day in the range, or the average is NA
			[from, at, xDays]
		);

		return result.map((record: NodeMeasurementV2AverageRecord) =>
			NodeMeasurementV2Average.fromDatabaseRecord(record)
		);
	}

	async findBetween(
		nodePublicKeyStorage: NodePublicKeyStorage,
		from: Date,
		to: Date
	): Promise<NodeMeasurementV2Statistics[]> {
		const result = await this.query(
			`with measurements as (
                SELECT "NodeMeasurementDay"."time",
                       "NodeMeasurementDay"."isActiveCount",
                       "NodeMeasurementDay"."isValidatingCount",
                       "NodeMeasurementDay"."isFullValidatorCount",
                       "NodeMeasurementDay"."isOverloadedCount",
                       "NodeMeasurementDay"."indexSum",
                       "NodeMeasurementDay"."crawlCount"
                FROM "node_measurement_day_v2" "NodeMeasurementDay"
                WHERE "nodePublicKeyStorageId" = $1
                  AND "time" >= date_trunc('day', $2::timestamp)
                  and "time" <= date_trunc('day', $3::timestamp)
            )
             select d.time,
                    coalesce("isActiveCount", 0)        "isActiveCount",
                    coalesce("isValidatingCount", 0)    "isValidatingCount",
                    coalesce("isOverloadedCount", 0)    "isOverloadedCount",
                    coalesce("isFullValidatorCount", 0) "isFullValidatorCount",
                    coalesce("indexSum", 0)             "indexSum",
                    coalesce("crawlCount", 0)           "crawlCount"
             from (select generate_series(date_trunc('day', $2::TIMESTAMP), date_trunc('day', $3::TIMESTAMP),
                                          interval '1 day')) d(time)
                      LEFT OUTER JOIN measurements on d.time = measurements.time  `,
			[nodePublicKeyStorage.id, from, to]
		);

		return result.map((record: NodeMeasurementV2StatisticsRecord) =>
			NodeMeasurementV2Statistics.fromDatabaseRecord(record)
		);
	}

	async findXDaysInactive(
		since: Date,
		numberOfDays: number
	): Promise<{ nodePublicKeyStorageId: number }[]> {
		return this.createQueryBuilder()
			.distinct(true)
			.select('"nodePublicKeyStorageId"')
			.where(
				"time >= :since::timestamptz - :numberOfDays * interval '1 days'",
				{ since: since, numberOfDays: numberOfDays }
			)
			.having('sum("isActiveCount") = 0')
			.groupBy(
				'"nodePublicKeyStorageId", time >= :since::timestamptz - :numberOfDays * interval \'1 days\''
			)
			.getRawMany();
	}

	async findXDaysActiveButNotValidating(
		since: Date,
		numberOfDays: number
	): Promise<{ nodePublicKeyStorageId: number }[]> {
		return this.createQueryBuilder()
			.distinct(true)
			.select('"nodePublicKeyStorageId"')
			.where(
				"time >= :since::timestamptz - :numberOfDays * interval '1 days'",
				{ since: since, numberOfDays: numberOfDays }
			)
			.having('sum("isActiveCount") > 0 AND sum("isValidatingCount") = 0')
			.groupBy(
				'"nodePublicKeyStorageId", time >= :since::timestamptz - :numberOfDays * interval \'1 days\''
			)
			.getRawMany();
	}

	async rollup(fromCrawlId: number, toCrawlId: number) {
		await this.query(
			`INSERT INTO node_measurement_day_v2 (time, "nodePublicKeyStorageId", "isActiveCount", "isValidatingCount",
                                                  "isFullValidatorCount", "isOverloadedCount", "indexSum", "crawlCount")
             with crawls as (
                 select date_trunc('day', "Crawl"."time") "crawlDay", count(distinct "Crawl2".id) "crawlCount"
                 from network_update "Crawl"
                          join network_update "Crawl2"
                               on date_trunc('day', "Crawl"."time") = date_trunc('day', "Crawl2"."time") AND
                                  "Crawl2".completed = true
                 WHERE "Crawl".id BETWEEN $1 AND $2
                   and "Crawl".completed = true
                 group by "crawlDay"
             )
             select date_trunc('day', "NetworkUpdate"."time") "day",
                    "nodePublicKeyStorageId",
                    sum("isActive"::int)                      "isActiveCount",
                    sum("isValidating"::int)                  "isValidatingCount",
                    sum("isFullValidator"::int)               "isFullValidatorCount",
                    sum("isOverLoaded"::int)                  "isOverloadedCount",
                    sum("index"::int)                         "indexSum",
                    "crawls"."crawlCount"                     "crawlCount"
             FROM "network_update" "NetworkUpdate"
                      join crawls on crawls."crawlDay" = date_trunc('day', "NetworkUpdate"."time")
                      join node_measurement_v2 on node_measurement_v2."time" = "NetworkUpdate"."time"
             WHERE "NetworkUpdate".id BETWEEN $1 AND $2
               AND "NetworkUpdate".completed = true
             group by day, "nodePublicKeyStorageId", "crawlCount"
             ON CONFLICT (time, "nodePublicKeyStorageId") DO UPDATE
                 SET "isActiveCount"        = node_measurement_day_v2."isActiveCount" + EXCLUDED."isActiveCount",
                     "isValidatingCount"    = node_measurement_day_v2."isValidatingCount" +
                                              EXCLUDED."isValidatingCount",
                     "isFullValidatorCount" = node_measurement_day_v2."isFullValidatorCount" +
                                              EXCLUDED."isFullValidatorCount",
                     "isOverloadedCount"    = node_measurement_day_v2."isOverloadedCount" +
                                              EXCLUDED."isOverloadedCount",
                     "indexSum"             = node_measurement_day_v2."indexSum" + EXCLUDED."indexSum",
                     "crawlCount"           = EXCLUDED."crawlCount"`,
			[fromCrawlId, toCrawlId]
		);
	}
}
