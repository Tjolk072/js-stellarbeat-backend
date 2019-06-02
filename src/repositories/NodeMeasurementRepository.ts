import {EntityRepository, Repository} from "typeorm";
import NodeMeasurement from "../entities/NodeMeasurement";

export interface MeasurementAverage {
    public_key:string,
    active_avg:string,
    validating_avg: string,
    over_loaded_avg: string
}

@EntityRepository(NodeMeasurement)
export class NodeMeasurementRepository extends Repository<NodeMeasurement> {

    findByTime(time: Date) {
        return this.findOne({ time });
    }

    findActivityValidatingAndLoadCountLatestXDays(days:number):Promise<MeasurementAverage[]> {
        return this.query('WITH crawl_count AS (' +
            '    SELECT count(*) AS "nr_of_crawls" FROM "crawl" "Crawl" ' +
            'WHERE time >= current_date - interval \'' +  days + '\' day' +
            ')' +
            '        SELECT "publicKey" as public_key,' +
            '               ROUND(100.0*(sum("isActive"::int::decimal )/nr_of_crawls),2) as active_avg,' +
            '               ROUND(100.0*(sum("isValidating"::int::decimal )/nr_of_crawls),2) as validating_avg,' +
            '               ROUND(100.0*(sum("isOverLoaded"::int::decimal )/nr_of_crawls),2) as over_loaded_avg' +
            '        FROM "node_measurement" "NodeMeasurement", crawl_count' +
            '        WHERE time >= current_date - interval \'' +  days + '\' day' +
            '        GROUP BY "publicKey", nr_of_crawls'
        );
    }
}