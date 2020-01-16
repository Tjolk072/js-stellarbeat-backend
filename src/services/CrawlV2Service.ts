import NodeSnapShotter from "./SnapShotting/NodeSnapShotter";
import {CrawlV2Repository} from "../repositories/CrawlV2Repository";
import {Node, Organization} from "@stellarbeat/js-stellar-domain";
import {NodeMeasurementV2Repository} from "../repositories/NodeMeasurementV2Repository";
import {NodeMeasurementDayV2Repository} from "../repositories/NodeMeasurementDayV2Repository";
import OrganizationSnapShotter from "./SnapShotting/OrganizationSnapShotter";
import {OrganizationMeasurementDayRepository} from "../repositories/OrganizationMeasurementDayRepository";
import {OrganizationMeasurementRepository} from "../repositories/OrganizationMeasurementRepository";
import {injectable} from "inversify";
import {LessThanOrEqual} from "typeorm";

@injectable()
export default class CrawlV2Service {

    protected nodeSnapShotter: NodeSnapShotter;
    protected organizationSnapShotter: OrganizationSnapShotter;
    protected crawlV2Repository: CrawlV2Repository;
    protected nodeMeasurementV2Repository: NodeMeasurementV2Repository;
    protected nodeMeasurementDayV2Repository: NodeMeasurementDayV2Repository;
    protected organizationMeasurementRepository: OrganizationMeasurementRepository;
    protected organizationMeasurementDayRepository: OrganizationMeasurementDayRepository;

    constructor(nodeSnapShotter: NodeSnapShotter, organizationSnapShotter: OrganizationSnapShotter, crawlV2Repository: CrawlV2Repository, nodeMeasurementV2Repository: NodeMeasurementV2Repository, nodeMeasurementDayV2Repository: NodeMeasurementDayV2Repository, organizationMeasurementRepository: OrganizationMeasurementRepository, organizationMeasurementDayRepository: OrganizationMeasurementDayRepository) {
        this.nodeSnapShotter = nodeSnapShotter;
        this.organizationSnapShotter = organizationSnapShotter;
        this.crawlV2Repository = crawlV2Repository;
        this.nodeMeasurementV2Repository = nodeMeasurementV2Repository;
        this.nodeMeasurementDayV2Repository = nodeMeasurementDayV2Repository;
        this.organizationMeasurementRepository = organizationMeasurementRepository;
        this.organizationMeasurementDayRepository = organizationMeasurementDayRepository;
    }

    async getCrawlAt(time: Date): Promise<{ nodes: Node[], organizations: Organization[], time: Date }> {
        // @ts-ignore
        let crawl = await this.crawlV2Repository.findOne(
            {
                where: {time: LessThanOrEqual(time), completed: true},
                order: {time: "DESC"},
                take: 1
            }
        );

        if (!crawl)
            throw new Error("No crawls found");

        let nodes = await this.getNodes(crawl.time);
        let organizations = await this.getOrganizations(crawl.time);

        return {
            nodes: nodes,
            organizations: organizations,
            time: crawl.time
        }
    }

    async getNodes(time: Date) {
        let activeSnapShots = await this.nodeSnapShotter.findSnapShotsActiveAtTime(time);
        let measurements = await this.nodeMeasurementV2Repository.find({
            where: {
                time: time
            }
        });

        let measurementsMap = new Map(measurements.map(measurement => {
            return [measurement.nodePublicKeyStorage.publicKey, measurement]
        }));

        let measurement24HourAverages = await this.nodeMeasurementV2Repository.findXDaysAverageAt(time, 1); //24 hours can be calculated 'live' quickly
        let measurement24HourAveragesMap = new Map(measurement24HourAverages.map(avg => {
            return [avg.nodeStoragePublicKeyId, avg]
        }));

        let measurement30DayAverages = await this.nodeMeasurementDayV2Repository.findXDaysAverageAt(time, 30);
        let measurement30DayAveragesMap = new Map(measurement30DayAverages.map(avg => {
            return [avg.nodeStoragePublicKeyId, avg]
        }));

        let nodes: Node[] = activeSnapShots
            .map(snapShot => snapShot
                .toNode(
                    time,
                    measurementsMap.get(snapShot.nodePublicKey.publicKey),
                    measurement24HourAveragesMap.get(snapShot.nodePublicKey.id),
                    measurement30DayAveragesMap.get(snapShot.nodePublicKey.id)
                )
            );

        return nodes;
    }

    async getOrganizations(time: Date) {
        let activeSnapShots = await this.organizationSnapShotter.findSnapShotsActiveAtTime(time);
        let measurements = await this.organizationMeasurementRepository.find({
            where: {
                time: time
            }
        });
        let measurementsMap = new Map(measurements.map(measurement => {
            return [measurement.organizationIdStorage.organizationId, measurement]
        }));

        let measurement24HourAverages = await this.organizationMeasurementRepository.findXDaysAverageAt(time, 1); //24 hours can be calculated 'live' quickly
        let measurement24HourAveragesMap = new Map(measurement24HourAverages.map(avg => {
            return [avg.organizationIdStorageId, avg]
        }));

        let measurement30DayAverages = await this.organizationMeasurementDayRepository.findXDaysAverageAt(time, 30);
        let measurement30DayAveragesMap = new Map(measurement30DayAverages.map(avg => {
            return [avg.organizationIdStorageId, avg]
        }));

        let organizations: Organization[] = activeSnapShots
            .map(snapShot => snapShot
                .toOrganization(
                    time,
                    measurementsMap.get(snapShot.organizationIdStorage.organizationId),
                    measurement24HourAveragesMap.get(snapShot.organizationIdStorage.id),
                    measurement30DayAveragesMap.get(snapShot.organizationIdStorage.id)
                )
            );

        return organizations;
    }
}