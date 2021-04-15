import {NodeMeasurementDayV2Repository} from "../repositories/NodeMeasurementDayV2Repository";
import NodeSnapShotRepository from "../repositories/NodeSnapShotRepository";
import CrawlV2 from "../entities/CrawlV2";
import OrganizationSnapShot from "../entities/OrganizationSnapShot";
import NodeSnapShot from "../entities/NodeSnapShot";
import OrganizationSnapShotRepository from "../repositories/OrganizationSnapShotRepository";
import {injectable} from "inversify";
import {NodeMeasurementV2Repository} from "../repositories/NodeMeasurementV2Repository";
import NodeSnapShotFactory from "../factory/NodeSnapShotFactory";

@injectable()
export default class Archiver {
    protected nodeMeasurementRepository: NodeMeasurementV2Repository
    protected nodeMeasurementDayV2Repository: NodeMeasurementDayV2Repository;
    protected nodeSnapShotRepository: NodeSnapShotRepository;
    protected organizationSnapShotRepository: OrganizationSnapShotRepository;
    protected nodeSnapShotFactory: NodeSnapShotFactory;

    constructor(nodeMeasurementRepository: NodeMeasurementV2Repository, nodeMeasurementDayV2Repository: NodeMeasurementDayV2Repository, nodeSnapShotRepository: NodeSnapShotRepository, organizationSnapShotRepository: OrganizationSnapShotRepository, nodeSnapShotFactory: NodeSnapShotFactory) {
        this.nodeMeasurementRepository = nodeMeasurementRepository;
        this.nodeMeasurementDayV2Repository = nodeMeasurementDayV2Repository;
        this.nodeSnapShotRepository = nodeSnapShotRepository;
        this.organizationSnapShotRepository = organizationSnapShotRepository;
        this.nodeSnapShotFactory = nodeSnapShotFactory;
    }

    static readonly VALIDATORS_MAX_DAYS_INACTIVE = 7;
    static readonly WATCHERS_MAX_DAYS_INACTIVE = 1;

    async archiveNodes(crawl: CrawlV2){
        await this.archiveInactiveValidators(crawl);
        await this.nodeSnapShotRepository.archiveInActiveWithMultipleIpSamePort(crawl.time);
        //await this.demoteValidators(crawl);
    }

    protected async archiveInactiveWatchers(crawl: CrawlV2){
        let nodePublicKeyStorageIds = (await this.nodeMeasurementDayV2Repository
            .findXDaysInactive(crawl.time, Archiver.WATCHERS_MAX_DAYS_INACTIVE))
            .map(result => result.nodePublicKeyStorageId);

        if(nodePublicKeyStorageIds.length === 0)
            return;

        let nodeSnapShots = await this.nodeSnapShotRepository.findActiveByPublicKeyStorageId(nodePublicKeyStorageIds);
        nodeSnapShots = nodeSnapShots.filter(nodeSnapShot => nodeSnapShot.quorumSet === null);
        console.log("Archiving inactive watchers: " + nodeSnapShots.map(snapshot => snapshot.nodePublicKey.publicKey));
        nodeSnapShots.forEach(nodeSnapShot => nodeSnapShot.endDate = crawl.time);

        //await this.nodeSnapShotRepository.save(nodeSnapShots); //Will enable after dry running some time
    }

    protected async archiveInactiveValidators(crawl:CrawlV2){
        let nodePublicKeyStorageIds = (await this.nodeMeasurementDayV2Repository
            .findXDaysInactive(crawl.time, Archiver.VALIDATORS_MAX_DAYS_INACTIVE))
            .map(result => result.nodePublicKeyStorageId);

        if(nodePublicKeyStorageIds.length === 0)
            return;

        let nodeSnapShots = await this.nodeSnapShotRepository.findActiveByPublicKeyStorageId(nodePublicKeyStorageIds);

        nodeSnapShots.forEach(nodeSnapShot => nodeSnapShot.endDate = crawl.time);

        await this.nodeSnapShotRepository.save(nodeSnapShots);
    }

    protected async demoteValidators(crawl: CrawlV2){
        let nodePublicKeyStorageIds = (await this.nodeMeasurementDayV2Repository
            .findXDaysInactiveValidators(crawl.time, Archiver.VALIDATORS_MAX_DAYS_INACTIVE))
            .map(result => result.nodePublicKeyStorageId);

        console.log("found validators to demote: " + nodePublicKeyStorageIds);

        if(nodePublicKeyStorageIds.length === 0)
            return;

        let nodeSnapShots = await this.nodeSnapShotRepository.findActiveByPublicKeyStorageId(nodePublicKeyStorageIds);

        let snapshotsToSave:NodeSnapShot[] = [];
        nodeSnapShots.forEach(nodeSnapShot => {
            nodeSnapShot.endDate = crawl.time;
            snapshotsToSave.push(nodeSnapShot);
            let newNodeSnapshot = this.nodeSnapShotFactory.createUpdatedSnapShot(nodeSnapShot, nodeSnapShot.toNode(crawl.time), crawl.time, null);
            newNodeSnapshot.quorumSet = null;//demote to validator
            snapshotsToSave.push(newNodeSnapshot);
        });

        //await this.nodeSnapShotRepository.save(snapshotsToSave) //Will enable after dry running some time
    }

    async archiveOrganizations(crawl: CrawlV2, activeOrganizationSnapShots: OrganizationSnapShot[], activeNodeSnapShots: NodeSnapShot[]) {
        //todo: align with archiving in update node command.
        /*
        let activeNodeSnapShotMap = new Map(activeNodeSnapShots.map(snapShot => [snapShot.nodePublicKey.id, snapShot]));
        let inactiveOrganizationSnapShots:OrganizationSnapShot[] = [];
        activeOrganizationSnapShots.forEach(
            organizationSnapShot => {
                let activeValidators = organizationSnapShot.validators.filter(validator => activeNodeSnapShotMap.get(validator.id));
                if(activeValidators.length === 0){
                    organizationSnapShot.endCrawl = crawl;
                    inactiveOrganizationSnapShots.push(organizationSnapShot);
                }
            }
        );
        await this.organizationSnapShotRepository.save(inactiveOrganizationSnapShots);
         */
    }
}