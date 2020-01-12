import {Entity, Column, ManyToOne, PrimaryGeneratedColumn, Index} from "typeorm";

import NodeQuorumSetStorage from "./NodeQuorumSetStorage";
import NodeGeoDataStorage from "./NodeGeoDataStorage";
import NodeDetailsStorage from "./NodeDetailsStorage";
import NodePublicKeyStorage from "./NodePublicKeyStorage";
import {Node} from "@stellarbeat/js-stellar-domain";
import CrawlV2 from "./CrawlV2";
import OrganizationIdStorage from "./OrganizationIdStorage";
import NodeMeasurementV2 from "./NodeMeasurementV2";
import {NodeMeasurementV2Average} from "../repositories/NodeMeasurementV2Repository";
import {logMethod} from "../logger";

export interface SnapShot {
    endCrawl: CrawlV2 | null;
}

/**
 * Type 2 Slowly Changing Dimensions
 */
@Entity('node_snap_shot')
@Index(["_startCrawl", "_endCrawl"])
export default class NodeSnapShot implements SnapShot {

    @PrimaryGeneratedColumn()
        // @ts-ignore
    id: number;

    @Index()
    @ManyToOne(type => NodePublicKeyStorage, {nullable: false, cascade: ['insert'], eager: true})
    protected _nodePublicKey?: NodePublicKeyStorage;

    @Column("text")
    ip: string;

    @Column("integer")
    port: number;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => NodeDetailsStorage, {nullable: true, cascade: ['insert'], eager: true})
    protected _nodeDetails?: NodeDetailsStorage | null;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => NodeQuorumSetStorage, {nullable: true, cascade: ['insert'], eager: true})
    protected _quorumSet?: NodeQuorumSetStorage | null;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => NodeGeoDataStorage, {nullable: true, cascade: ['insert'], eager: true})
    protected _geoData?: NodeGeoDataStorage | null = null;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => OrganizationIdStorage, {nullable: true, cascade: ['insert'], eager: true})
    protected _organizationIdStorage?: OrganizationIdStorage | null;

    @ManyToOne(type => CrawlV2, {nullable: false, cascade: ['insert'], eager: true})
    @Index()
    protected _startCrawl?: CrawlV2;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => CrawlV2, {nullable: true, cascade: ['insert'], eager: true})
    @Index()
    protected _endCrawl?: CrawlV2 | null;

    //We want to filter out constant changes in ip and ports due to badly configured validators.
    @Column("bool")
    ipChange: boolean = false;

    //typeOrm does not fill in constructor parameters. should be fixed in a later version.
    constructor(nodeStorage: NodePublicKeyStorage, startCrawl: CrawlV2, ip: string, port: number) {
        this.nodePublicKey = nodeStorage;
        this.ip = ip;
        this.port = port;
        this.startCrawl = startCrawl;
    }

    set organizationIdStorage(organizationIdStorage: OrganizationIdStorage | null) {
        this._organizationIdStorage = organizationIdStorage;
    }

    get organizationIdStorage() {
        if (this._organizationIdStorage === undefined) {
            throw new Error('Organization snapshot not loaded from database');
        }

        return this._organizationIdStorage;
    }

    set nodePublicKey(nodePublicKeyStorage: NodePublicKeyStorage) {
        this._nodePublicKey = nodePublicKeyStorage;
    }

    get nodePublicKey() {
        if (this._nodePublicKey === undefined) {
            throw new Error('Node public key not loaded from database');
        }

        return this._nodePublicKey;
    }

    set nodeDetails(nodeDetails: NodeDetailsStorage | null) {
        this._nodeDetails = nodeDetails;
    }

    get nodeDetails() {
        if (this._nodeDetails === undefined) {
            throw new Error('Node details not loaded from database');
        }

        return this._nodeDetails;
    }

    set quorumSet(quorumSet: NodeQuorumSetStorage | null) {
        this._quorumSet = quorumSet;
    }

    get quorumSet() {
        if (this._quorumSet === undefined) {
            throw new Error('Node quorumSet not loaded from database');
        }

        return this._quorumSet;
    }

    set geoData(geoData: NodeGeoDataStorage | null) {
        this._geoData = geoData;
    }

    get geoData() {
        if (this._geoData === undefined) {
            throw new Error('Node geoData not loaded from database');
        }

        return this._geoData;
    }

    set startCrawl(startCrawl: CrawlV2) {
        this._startCrawl = startCrawl;
    }

    get startCrawl() {
        if (this._startCrawl === undefined) {
            throw new Error('StartCrawl not loaded from database');
        }

        return this._startCrawl;
    }

    set endCrawl(endCrawl: CrawlV2 | null) {
        this._endCrawl = endCrawl;
    }

    get endCrawl() {
        if (this._endCrawl === undefined) {
            throw new Error('endCrawl not loaded from database');
        }

        return this._endCrawl;
    }

    quorumSetChanged(node: Node): boolean {
        if (this.quorumSet === null && node.quorumSet && node.quorumSet.validators)
            return node.quorumSet.validators.length > 0;

        if (this.quorumSet === null) {
            return false;
        }

        return this.quorumSet.hash !== node.quorumSet.hashKey;
    }

    nodeIpPortChanged(node: Node): boolean {
        return this.ip !== node.ip
            || this.port !== node.port;
    }

    nodeDetailsChanged(node: Node): boolean {
        if (this.nodeDetails === null)
            return node.versionStr !== undefined || node.overlayVersion !== undefined || node.overlayMinVersion !== undefined || node.ledgerVersion !== undefined;
        //database storage returns null when not set and node returns undefined. So no strict equality check here.
        return this.nodeDetails.alias != node.alias
            || this.nodeDetails.historyUrl != node.historyUrl
            || this.nodeDetails.homeDomain != node.homeDomain
            || this.nodeDetails.host != node.host
            || this.nodeDetails.isp != node.isp
            || this.nodeDetails.ledgerVersion != node.ledgerVersion
            || this.nodeDetails.name != node.name
            || this.nodeDetails.overlayMinVersion != node.overlayMinVersion
            || this.nodeDetails.overlayVersion != node.overlayVersion
            || this.nodeDetails.versionStr != node.versionStr;
    }

    organizationChanged(node: Node) {
        if (this.organizationIdStorage === null)
            return node.organizationId !== undefined;

        return this.organizationIdStorage.organizationId !== node.organizationId;
    }

    geoDataChanged(node: Node): boolean {
        if (this.geoData === null) {
            return node.geoData.latitude !== undefined || node.geoData.longitude !== undefined;
        }

        //database stores null instead of undefined. We need strict equality checks for zero values.
        return (this.geoData.latitude !== undefined ?
            this.geoData.latitude !== node.geoData.latitude : this.geoData.latitude != node.geoData.latitude)
            ||
            (this.geoData.longitude !== undefined ?
                this.geoData.longitude !== node.geoData.longitude : this.geoData.longitude != node.geoData.longitude)
    }

    hasNodeChanged(crawledNode: Node) {
        if (this.quorumSetChanged(crawledNode))
            return true;
        if (this.nodeIpPortChanged(crawledNode))
            return true;
        if (this.nodeDetailsChanged(crawledNode))
            return true;
        if (this.geoDataChanged(crawledNode))
            return true;

        return this.organizationChanged(crawledNode);
    }

    @logMethod
    toNode( //todo: move to factory
        crawl: CrawlV2,
        measurement?: NodeMeasurementV2,
        measurement24HourAverage?: NodeMeasurementV2Average,
        measurement30DayAverage?: NodeMeasurementV2Average) {

        let node = new Node(this.ip, this.port);
        node.publicKey = this.nodePublicKey.publicKey;
        node.dateDiscovered = this.nodePublicKey.dateDiscovered;
        node.dateUpdated = crawl.validFrom; //should be removed, makes no sense anymore
        if (this.quorumSet)
            node.quorumSet = this.quorumSet.quorumSet;
        if (this.geoData) {
            node.geoData = this.geoData.toGeoData(crawl);
        } else {
            node.geoData.dateUpdated = crawl.validFrom;
        }
        if (this.nodeDetails) {
            this.nodeDetails.updateNodeWithDetails(node);
        }
        if (this.organizationIdStorage) {
            node.organizationId = this.organizationIdStorage.organizationId;
        }

        if (measurement) {
            node.active = measurement.isActive;
            node.isValidating = measurement.isValidating;
            node.isFullValidator = measurement.isFullValidator;
            node.overLoaded = measurement.isOverLoaded;
            node.statistics.activeInLastCrawl = measurement.isActive;
            node.statistics.validatingInLastCrawl = measurement.isValidating;
            node.statistics.overLoadedInLastCrawl = measurement.isOverLoaded;
            node.index = measurement.index / 100;
        }

        if (measurement24HourAverage) {
            node.statistics.active24HoursPercentage = measurement24HourAverage.activeAvg;
            node.statistics.validating24HoursPercentage = measurement24HourAverage.validatingAvg;
            node.statistics.overLoaded24HoursPercentage = measurement24HourAverage.overLoadedAvg;
        }

        if(measurement30DayAverage) {
            node.statistics.has30DayStats = true;
            node.statistics.active30DaysPercentage = measurement30DayAverage.activeAvg;
            node.statistics.validating30DaysPercentage = measurement30DayAverage.validatingAvg;
            node.statistics.overLoaded30DaysPercentage = measurement30DayAverage.overLoadedAvg;
        } else {
            node.statistics.has30DayStats = false;
        }

        return node;
    }

    toString(){
        return `NodeSnapShot (id:${this.id})`
    }
}