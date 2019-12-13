import {Entity, Column, PrimaryGeneratedColumn, Index} from "typeorm";
import {NodeGeoData} from "@stellarbeat/js-stellar-domain";

@Entity('geo_data')
export default class GeoDataStorage {

    @PrimaryGeneratedColumn()
        // @ts-ignore
    id: number;

    @Index()
    @Column("varchar", {length: 10, nullable: true})
    countryCode: string | null = null;
    @Column("varchar", {length: 255, nullable: true})
    countryName: string | null = null;

    @Column("numeric", {name: 'latitude', nullable: true})
    _latitude: string | null = null;
    @Column("numeric", {name: 'longitude', nullable: true})
    _longitude: string | null = null;

    static fromGeoData(geoData: NodeGeoData):GeoDataStorage|null {
        let geoDataStorage = new this();

        if(geoData.latitude === undefined)
            return null;

        geoDataStorage.latitude = geoData.latitude;
        geoDataStorage.countryCode = geoData.countryCode ? geoData.countryCode : null;
        geoDataStorage.countryName = geoData.countryName ? geoData.countryName : null;
        geoDataStorage.longitude = geoData.longitude ? geoData.longitude : null;


        return geoDataStorage;
    }

    set latitude(value:number|null) {
        if(value)
            this._latitude = value.toString();
    }

    get latitude():number|null {
        if(this._latitude)
            return Number(this._latitude);

        return null;
    }

    set longitude(value:number|null) {
        if(value)
            this._longitude = value.toString();
    }

    get longitude():number|null {
        if(this._longitude)
            return Number(this._longitude);

        return null;
    }

    toGeoData(): NodeGeoData {
        let geoData = new NodeGeoData();
        geoData.countryCode = this.countryCode ? this.countryCode : undefined;
        geoData.countryName = this.countryName ? this.countryName : undefined;
        geoData.longitude = this.longitude ? this.longitude : undefined;
        geoData.latitude = this.latitude ? this.latitude : undefined;

        return geoData;
    }
}