import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	Index,
	Repository
} from 'typeorm';
import { SnapShotUniqueIdentifier } from './NodePublicKeyStorage';

export type OrganizationIdStorageRepository = Repository<OrganizationIdStorage>;

/**
 * Stores the unique organization id's, regardless of versions.
 */
@Entity('organization_id')
export default class OrganizationIdStorage implements SnapShotUniqueIdentifier {
	@PrimaryGeneratedColumn()
	// @ts-ignore
	id: number;

	@Column('text', { nullable: false })
	@Index({ unique: true })
	organizationId: string;

	@Column('text', { nullable: true })
	homeDomain: string | null = null;
	//null is allowed and value is not unique for backwards compatibility with older versions of stellarbeat

	@Column('timestamptz')
	dateDiscovered: Date;

	constructor(organizationId: string, dateDiscovered: Date = new Date()) {
		this.organizationId = organizationId;
		this.dateDiscovered = dateDiscovered;
	}
}
