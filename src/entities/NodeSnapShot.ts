import {Entity, Column, ManyToOne, PrimaryGeneratedColumn, Index} from "typeorm";

import NodeQuorumSetStorage from "./NodeQuorumSetStorage";
import NodeGeoDataStorage from "./NodeGeoDataStorage";
import NodeDetailsStorage from "./NodeDetailsStorage";
import NodePublicKeyStorage from "./NodePublicKeyStorage";
import {Node} from "@stellarbeat/js-stellar-domain";
import CrawlV2 from "./CrawlV2";
import OrganizationIdStorage from "./OrganizationIdStorage";

/**
 * Type 2 Slowly Changing Dimensions
 */
@Entity('node_snap_shot')
@Index(["startCrawl", "endCrawl"])
export default class NodeSnapShot {

    @PrimaryGeneratedColumn()
        // @ts-ignore
    id: number;

    @Index()
    @ManyToOne(type => NodePublicKeyStorage, {nullable: false, cascade: ['insert'], eager: true})
    nodePublicKey: NodePublicKeyStorage;

    @Column("text")
    ip: string;

    @Column("integer")
    port: number;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => NodeDetailsStorage, {nullable: true, cascade: ['insert'], eager: true})
    nodeDetails?: NodeDetailsStorage | null;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => NodeQuorumSetStorage, {nullable: true, cascade: ['insert'], eager: true})
    quorumSet?: NodeQuorumSetStorage | null;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => NodeGeoDataStorage, {nullable: true, cascade: ['insert'], eager: true})
    geoData?: NodeGeoDataStorage | null = null;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => OrganizationIdStorage, {nullable: true, cascade: ['insert'], eager: true})
    _organizationIdStorage?: OrganizationIdStorage | null;

    @ManyToOne(type => CrawlV2, {nullable: false, cascade: ['insert'], eager: true})
    @Index()
    startCrawl?: CrawlV2 | Promise<CrawlV2>;

    //Do not initialize on null, or you cannot make the difference between 'not selected in query' (=undefined), or 'actually null' (=null)
    @ManyToOne(type => CrawlV2, {nullable: true, cascade: ['insert'], eager: true})
    @Index()
    endCrawl?: CrawlV2 | null;

    //typeOrm does not fill in constructor parameters. should be fixed in a later version.
    constructor(nodeStorage: NodePublicKeyStorage, startCrawl: CrawlV2, ip: string, port: number) {
        this.nodePublicKey = nodeStorage;
        this.ip = ip;
        this.port = port;
        this.startCrawl = startCrawl;
    }

    set organizationIdStorage(organizationIdStorage: OrganizationIdStorage|null) {
        this._organizationIdStorage = organizationIdStorage;
    }

    get organizationIdStorage() {
        if (this._organizationIdStorage === undefined) {
            throw new Error('Organization snapshot not loaded from database');
        }
        
        return this._organizationIdStorage;
    }
    
    quorumSetChanged(node: Node): boolean {
        if (this.quorumSet === undefined) {
            throw new Error('QuorumSet not loaded from database');
        }
        if (this.quorumSet === null && node.quorumSet && node.quorumSet.validators)
            return node.quorumSet.validators.length > 0;

        if(this.quorumSet === null) {
            return false;
        }

        return this.quorumSet.hash !== node.quorumSet.hashKey;
    }

    nodeIpPortChanged(node: Node): boolean {
        return this.ip !== node.ip
            || this.port !== node.port;
    }

    nodeDetailsChanged(node: Node): boolean {
        if (this.nodeDetails === undefined) {
            throw new Error('NodeDetails not loaded from database');
        }
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
        if (this.geoData === undefined) {
            throw new Error('GeoData not loaded from database');
        }
        if (this.geoData === null) {
            return node.geoData.latitude !== undefined || node.geoData.longitude !== undefined;
        }
        //database storage returns null when not set and node returns undefined. So no strict equality check here.
        return this.geoData.latitude != node.geoData.latitude
            || this.geoData.longitude != node.geoData.longitude;
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
}