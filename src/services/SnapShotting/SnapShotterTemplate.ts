import {Node, Organization} from "@stellarbeat/js-stellar-domain";
import CrawlV2 from "../../entities/CrawlV2";
import * as Sentry from "@sentry/node";
import {SnapShot} from "../../entities/NodeSnapShot";
import {injectable} from "inversify";

type Entity = Node|Organization;

@injectable()
export default abstract class SnapShotterTemplate {

    async updateOrCreateSnapShots(entities: Entity[], crawl: CrawlV2):Promise<SnapShot[]> {
        let activeSnapShots = await this.findActiveSnapShots();
        activeSnapShots = await this.updateActiveSnapShots(activeSnapShots, entities, crawl);
        let entitiesWithoutSnapShots = this.getEntitiesWithoutSnapShots(activeSnapShots, entities);
        console.log("[SnapShotter]: newly detected entities: " + entitiesWithoutSnapShots);
        let newSnapShots = await this.createSnapShots(entitiesWithoutSnapShots, crawl);

        return [...activeSnapShots, ...newSnapShots];
    }

    protected async updateActiveSnapShots(activeSnapShots: SnapShot[], entities: Entity[], crawl: CrawlV2) {
        let entityMap = this.getIdToEntityMap(entities);
        let newActiveSnapShots: SnapShot[] = []; //because an entity change could trigger a new snapshot, we want to return the 'new' active snapshots
        for (let snapShot of activeSnapShots) {
            try {
                let entity = this.getEntityConnectedToSnapShot(snapShot, entityMap);
                if (entity) {
                    if(!this.entityShouldBeTracked(entity))//no new snapshot should be created
                        await this.archiveSnapShot(snapShot, crawl.time);
                    else {
                        let newActiveSnapShot = await this.updateActiveSnapShot(snapShot, entity, crawl);
                        //if entity was updated, a new snapshot is created
                        newActiveSnapShots.push(newActiveSnapShot);
                    }
                } else {
                    newActiveSnapShots.push(snapShot);//snapshot has not changed
                }
            } catch (e) {
                console.log(e); //todo winston
                Sentry.captureException(e);
            }
        }

        return newActiveSnapShots;
    }

    protected async updateActiveSnapShot(activeSnapShot: SnapShot, entity: Entity, crawl: CrawlV2) {
        if(this.entityChangeShouldBeIgnored(activeSnapShot, entity, crawl))
            return activeSnapShot;
        if (this.hasEntityChanged(activeSnapShot, entity)) {
            await this.archiveSnapShot(activeSnapShot, crawl.time); //we archive the current active snapshot
            return await this.createUpdatedSnapShot(activeSnapShot, entity, crawl); //we create a new snapshot based on the old one.
        } else {
            return activeSnapShot;
        }
    }

    /**
     * Entities that are new or were inactive for a long time and were archived
     */
    protected getEntitiesWithoutSnapShots(activeSnapShots: SnapShot[], entities: Entity[]) {
        let snapShotsMap = this.getIdToSnapShotMap(activeSnapShots);

        let entitiesWithoutSnapShots: Entity[] = [];
        entities.forEach(entity => {
            let snapShot = this.getSnapShotConnectedToEntity(entity, snapShotsMap);
            if (!snapShot) {
                entitiesWithoutSnapShots.push(entity);
            }
        });

        return entitiesWithoutSnapShots;
    }

    protected async createSnapShots(entitiesWithoutSnapShots: Entity[], crawl: CrawlV2) {
        let newSnapShots: SnapShot[] = [];
        for(let entityWithoutSnapShot of entitiesWithoutSnapShots){
            try {
                if(this.entityShouldBeTracked(entityWithoutSnapShot)) {
                    let snapShot = await this.createSnapShot(entityWithoutSnapShot, crawl);
                    if (snapShot)
                        newSnapShots.push(snapShot);
                }
            } catch (e) {
                console.log(e);
                Sentry.captureException(e);
            }
        }

        return newSnapShots;
    }

    abstract findActiveSnapShots(): Promise<SnapShot[]>;
    protected abstract getIdToEntityMap(entities: Entity[]): Map<string, Entity>;
    protected abstract getIdToSnapShotMap(snapShots: SnapShot[]): Map<string, SnapShot>;
    protected abstract getEntityConnectedToSnapShot(snapShot: SnapShot, idToEntityMap: Map<string, Entity>): Entity|undefined;
    protected abstract getSnapShotConnectedToEntity(entity: Entity, idToSnapShotMap: Map<string, SnapShot>): SnapShot|undefined;
    protected abstract hasEntityChanged(snapShot: SnapShot, entity: Entity): boolean;
    protected abstract createUpdatedSnapShot(snapShot: SnapShot, entity: Entity, crawl: CrawlV2): Promise<SnapShot>;
    protected abstract createSnapShot(entity: Entity, crawl: CrawlV2): Promise<SnapShot|undefined>;
    protected abstract saveSnapShot(snapShot: SnapShot):Promise<SnapShot>;
    //update the endDate of the snapshot and save it
    protected abstract async archiveSnapShot(snapShot: SnapShot, time: Date): Promise<void>;
    //certain entity configurations are invalid and should not be tracked with snapshots
    protected abstract entityShouldBeTracked(entity: Entity): boolean;
    //certain entity changes are ignored to avoid filling up the database
    protected abstract entityChangeShouldBeIgnored(snapShot: SnapShot, entity: Entity, crawl: CrawlV2):boolean;
}