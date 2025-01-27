import SnapShotterTemplate from './SnapShotterTemplate';
import NodeSnapShotRepository from '../repositories/NodeSnapShotRepository';
import NodeSnapShotFactory from './factory/NodeSnapShotFactory';
import NodePublicKeyStorage, {
	NodePublicKeyStorageRepository
} from '../entities/NodePublicKeyStorage';
import OrganizationIdStorage, {
	OrganizationIdStorageRepository
} from '../entities/OrganizationIdStorage';
import {
	Node,
	OrganizationId,
	PublicKey
} from '@stellarbeat/js-stellar-domain';
import NodeSnapShot from '../entities/NodeSnapShot';
import olderThanOneDay from './filters/OlderThanOneDay';
import { inject, injectable } from 'inversify';
import { ExceptionLogger } from '../../../../shared/services/ExceptionLogger';
import { Logger } from '../../../../shared/services/PinoLogger';

@injectable()
export default class NodeSnapShotter extends SnapShotterTemplate {
	constructor(
		protected nodeSnapShotRepository: NodeSnapShotRepository,
		protected nodeSnapShotFactory: NodeSnapShotFactory,
		@inject('NodePublicKeyStorageRepository')
		protected nodePublicKeyStorageRepository: NodePublicKeyStorageRepository,
		@inject('OrganizationIdStorageRepository')
		protected organizationIdStorageRepository: OrganizationIdStorageRepository,
		@inject('ExceptionLogger') protected exceptionLogger: ExceptionLogger,
		@inject('Logger') protected logger: Logger
	) {
		super(exceptionLogger, logger);
	}

	async updateOrCreateSnapShots(
		entities: Node[],
		time: Date
	): Promise<NodeSnapShot[]> {
		return (await super.updateOrCreateSnapShots(
			entities,
			time
		)) as NodeSnapShot[];
	}

	async findActiveSnapShots() {
		return await this.nodeSnapShotRepository.findActive();
	}

	async findSnapShotsActiveAtTime(time: Date) {
		return await this.nodeSnapShotRepository.findActiveAtTime(time);
	}

	async findLatestSnapShots(at: Date) {
		return await this.nodeSnapShotRepository.findLatest(at);
	}

	async findLatestSnapShotsByNode(publicKey: string, at: Date) {
		const nodePublicKeyStorage = await this.findNodePublicKeyStorage(publicKey);
		if (!nodePublicKeyStorage) return [];

		return await this.nodeSnapShotRepository.findLatestByNode(
			nodePublicKeyStorage,
			at
		);
	}

	protected async createSnapShot(node: Node, time: Date) {
		let nodePublicKeyStorage = await this.findNodePublicKeyStorage(
			node.publicKey
		);

		if (!nodePublicKeyStorage)
			nodePublicKeyStorage = new NodePublicKeyStorage(node.publicKey, time);

		let organizationIdStorage: OrganizationIdStorage | null = null;
		if (node.organizationId)
			organizationIdStorage = await this.findOrCreateOrganizationIdStorage(
				node.organizationId,
				time
			);

		const snapShot = this.nodeSnapShotFactory.create(
			nodePublicKeyStorage,
			node,
			time,
			organizationIdStorage
		);
		await this.nodeSnapShotRepository.save(snapShot);

		return snapShot;
	}

	protected getEntityConnectedToSnapShot(
		snapShot: NodeSnapShot,
		idToEntityMap: Map<string, Node>
	): Node | undefined {
		return idToEntityMap.get(snapShot.nodePublicKey.publicKey);
	}

	protected getIdToEntityMap(entities: Node[]): Map<string, Node> {
		return new Map(entities.map((node) => [node.publicKey, node]));
	}

	protected getIdToSnapShotMap(
		snapShots: NodeSnapShot[]
	): Map<string, NodeSnapShot> {
		return new Map(
			snapShots.map((snapshot) => [snapshot.nodePublicKey.publicKey, snapshot])
		);
	}

	protected getSnapShotConnectedToEntity(
		entity: Node,
		idToSnapShotMap: Map<string, NodeSnapShot>
	): NodeSnapShot | undefined {
		return idToSnapShotMap.get(entity.publicKey);
	}

	protected hasEntityChanged(snapShot: NodeSnapShot, entity: Node): boolean {
		return snapShot.hasNodeChanged(entity);
	}

	protected async createUpdatedSnapShot(
		snapShot: NodeSnapShot,
		entity: Node,
		time: Date
	): Promise<NodeSnapShot> {
		let organizationIdStorage: OrganizationIdStorage | null;
		if (snapShot.organizationChanged(entity)) {
			if (
				entity.organizationId === undefined ||
				entity.organizationId === null
			) {
				organizationIdStorage = null;
			} else {
				//careful for race conditions.
				organizationIdStorage = await this.findOrCreateOrganizationIdStorage(
					entity.organizationId,
					time
				);
			}
		} else {
			organizationIdStorage = snapShot.organizationIdStorage;
		}

		const newSnapShot = this.nodeSnapShotFactory.createUpdatedSnapShot(
			snapShot,
			entity,
			time,
			organizationIdStorage
		);
		if (snapShot.nodeIpPortChanged(entity)) newSnapShot.ipChange = true;

		await this.nodeSnapShotRepository.save([snapShot, newSnapShot]);
		return newSnapShot;
	}

	protected async findNodePublicKeyStorage(publicKey: PublicKey) {
		return await this.nodePublicKeyStorageRepository.findOne({
			where: { publicKey: publicKey }
		});
	}

	protected async findOrCreateOrganizationIdStorage(
		organizationId: OrganizationId,
		time: Date
	) {
		let organizationIdStorage =
			await this.organizationIdStorageRepository.findOne({
				where: { organizationId: organizationId }
			});

		if (!organizationIdStorage) {
			organizationIdStorage = new OrganizationIdStorage(organizationId, time);
		}

		return organizationIdStorage;
	}

	protected async archiveSnapShot(snapshot: NodeSnapShot, time: Date) {
		snapshot.endDate = time;
		await this.nodeSnapShotRepository.save(snapshot);
	}

	protected entityShouldBeArchived() {
		//We track all node entities
		return Promise.resolve(false);
	}

	protected entityChangeShouldBeIgnored(
		snapShot: NodeSnapShot,
		entity: Node,
		time: Date
	): boolean {
		return (
			snapShot.nodeIpPortChanged(entity) &&
			snapShot.ipChange &&
			!olderThanOneDay(snapShot.startDate, time)
		);
		//we want to ignore constant ip changes due to badly configured nodes, so a node only gets 1 ip change a day.
	}
}
