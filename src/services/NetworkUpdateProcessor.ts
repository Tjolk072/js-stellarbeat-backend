import {
	Network,
	Node,
	NodeIndex,
	Organization,
	PublicKey
} from '@stellarbeat/js-stellar-domain';
import { NetworkUpdateRepository } from '../repositories/NetworkUpdateRepository';
import NetworkUpdate from '../entities/NetworkUpdate';
import { Connection } from 'typeorm';
import NodeMeasurementV2 from '../entities/NodeMeasurementV2';
import NodeSnapShot from '../entities/NodeSnapShot';
import OrganizationSnapShot from '../entities/OrganizationSnapShot';
import OrganizationMeasurement from '../entities/OrganizationMeasurement';
import NetworkMeasurement from '../entities/NetworkMeasurement';
import MeasurementsRollupService from './MeasurementsRollupService';
import NodeSnapShotArchiver from './NodeSnapShotArchiver';
import { inject, injectable } from 'inversify';
import FbasAnalyzerService from './FbasAnalyzerService';
import SnapShotter from './SnapShotting/SnapShotter';
import { Result, err, ok } from 'neverthrow';
import { Logger } from './PinoLogger';
import { ExceptionLogger } from './ExceptionLogger';
import NetworkService from './NetworkService';

@injectable()
export class NetworkUpdateProcessor {
	constructor(
		protected networkService: NetworkService,
		protected networkUpdateRepository: NetworkUpdateRepository,
		protected snapShotter: SnapShotter,
		protected measurementRollupService: MeasurementsRollupService,
		protected archiver: NodeSnapShotArchiver,
		protected connection: Connection,
		protected fbasAnalyzer: FbasAnalyzerService,
		@inject('Logger') protected logger: Logger,
		@inject('ExceptionLogger') protected exceptionLogger: ExceptionLogger
	) {}

	async processNetworkUpdate(
		networkUpdate: NetworkUpdate,
		nodes: Node[],
		organizations: Organization[]
	): Promise<Result<NetworkUpdate, Error>> {
		try {
			const previousNetwork = this.networkService.getNetwork();
			const network = new Network(nodes, organizations);

			await this.networkUpdateRepository.save(networkUpdate);

			const snapShots = await this.snapShotter.updateOrCreateSnapShots(
				nodes,
				organizations,
				networkUpdate.time
			);
			const publicKeyToNodeMap = new Map<PublicKey, Node>(
				nodes.map((node) => [node.publicKey, node])
			);

			await this.createNodeMeasurements(
				network,
				snapShots.nodeSnapShots,
				networkUpdate,
				publicKeyToNodeMap
			);

			await this.createOrganizationMeasurements(
				organizations,
				snapShots.organizationSnapShots,
				networkUpdate,
				publicKeyToNodeMap
			);

			const result = await this.createNetworkMeasurements(
				network,
				networkUpdate
			);

			if (result.isErr()) {
				return err(result.error);
			}

			networkUpdate.completed = true;
			await this.networkUpdateRepository.save(networkUpdate);

			/*
            Step 3: rollup measurements
             */
			await this.measurementRollupService.rollupMeasurements(networkUpdate);
			/*
            Step 4: Archiving
            */
			await this.archiver.archiveNodes(networkUpdate); //todo move up?
			/*
			Step 5: Create events for notifications
			 */

			return ok(networkUpdate);
		} catch (e) {
			let error: Error;
			if (!(e instanceof Error))
				error = new Error('Error processing network update');
			else error = e;

			return err(error);
		}
	}

	private async createNetworkMeasurements(
		network: Network,
		networkUpdate: NetworkUpdate
	): Promise<Result<undefined, Error>> {
		const networkMeasurement = new NetworkMeasurement(networkUpdate.time);

		const analysisResult = await this.fbasAnalyzer.performAnalysis(network);

		if (analysisResult.isErr()) return err(analysisResult.error);

		const analysis = analysisResult.value;
		this.logger.info('Network analysis cache hit? ' + analysis.cacheHit);

		networkMeasurement.hasQuorumIntersection = analysis.hasQuorumIntersection;
		networkMeasurement.hasSymmetricTopTier = analysis.hasSymmetricTopTier;

		networkMeasurement.minBlockingSetSize = analysis.minimalBlockingSetsMinSize;
		networkMeasurement.minBlockingSetFilteredSize =
			analysis.minimalBlockingSetsFaultyNodesFilteredMinSize;
		networkMeasurement.minBlockingSetOrgsSize =
			analysis.orgMinimalBlockingSetsMinSize;
		networkMeasurement.minBlockingSetCountrySize =
			analysis.countryMinimalBlockingSetsMinSize;
		networkMeasurement.minBlockingSetISPSize =
			analysis.ispMinimalBlockingSetsMinSize;
		networkMeasurement.minBlockingSetOrgsFilteredSize =
			analysis.orgMinimalBlockingSetsFaultyNodesFilteredMinSize;
		networkMeasurement.minBlockingSetCountryFilteredSize =
			analysis.countryMinimalBlockingSetsFaultyNodesFilteredMinSize;
		networkMeasurement.minBlockingSetISPFilteredSize =
			analysis.ispMinimalBlockingSetsFaultyNodesFilteredMinSize;
		networkMeasurement.minSplittingSetSize =
			analysis.minimalSplittingSetsMinSize;
		networkMeasurement.minSplittingSetOrgsSize =
			analysis.orgMinimalSplittingSetsMinSize;
		networkMeasurement.minSplittingSetCountrySize =
			analysis.countryMinimalSplittingSetsMinSize;
		networkMeasurement.minSplittingSetISPSize =
			analysis.ispMinimalSplittingSetsMinSize;
		networkMeasurement.topTierSize = analysis.topTierSize;
		networkMeasurement.topTierOrgsSize = analysis.orgTopTierSize;
		networkMeasurement.nrOfActiveWatchers =
			network.networkStatistics.nrOfActiveWatchers;
		networkMeasurement.nrOfActiveValidators =
			network.networkStatistics.nrOfActiveValidators;
		networkMeasurement.nrOfActiveFullValidators =
			network.networkStatistics.nrOfActiveFullValidators;
		networkMeasurement.nrOfActiveOrganizations =
			network.networkStatistics.nrOfActiveOrganizations;
		networkMeasurement.transitiveQuorumSetSize =
			network.networkStatistics.transitiveQuorumSetSize;
		networkMeasurement.hasTransitiveQuorumSet =
			network.networkStatistics.hasTransitiveQuorumSet;

		try {
			await this.connection.manager.insert(
				NetworkMeasurement,
				networkMeasurement
			);
		} catch (e) {
			if (e instanceof Error) return err(e);

			return err(new Error('Error inserting network measurement in db'));
		}

		return ok(undefined);
	}

	private async createOrganizationMeasurements(
		organizations: Organization[],
		allSnapShots: OrganizationSnapShot[],
		networkUpdate: NetworkUpdate,
		publicKeyToNodeMap: Map<PublicKey, Node>
	) {
		if (allSnapShots.length <= 0) {
			return;
		}

		const organizationIdToOrganizationMap = new Map<string, Organization>(
			organizations.map((organization) => [organization.id, organization])
		);

		const organizationMeasurements: OrganizationMeasurement[] = [];
		allSnapShots.forEach((snapShot) => {
			const organization = organizationIdToOrganizationMap.get(
				snapShot.organizationIdStorage.organizationId
			);

			if (organization) {
				const organizationMeasurement = new OrganizationMeasurement(
					networkUpdate.time,
					snapShot.organizationIdStorage
				);
				organizationMeasurement.isSubQuorumAvailable =
					this.getOrganizationFailAt(organization, publicKeyToNodeMap) >= 1;
				organizationMeasurement.index = 0; //future proof
				organizationMeasurements.push(organizationMeasurement);
			}
		});

		if (organizationMeasurements.length <= 0) return;

		await this.connection.manager.insert(
			OrganizationMeasurement,
			organizationMeasurements
		);
	}

	private getOrganizationFailAt(
		organization: Organization,
		publicKeyToNodeMap: Map<PublicKey, Node>
	) {
		const nrOfValidatingNodes = organization.validators
			.map((validator) => publicKeyToNodeMap.get(validator))
			.filter((validator) => validator !== undefined)
			.filter((validator) => (validator as Node).isValidating).length;
		return nrOfValidatingNodes - organization.subQuorumThreshold + 1;
	}

	private async createNodeMeasurements(
		network: Network,
		allSnapShots: NodeSnapShot[],
		networkUpdate: NetworkUpdate,
		publicKeyToNodeMap: Map<PublicKey, Node>
	) {
		if (allSnapShots.length <= 0) {
			return;
		}
		const publicKeys: Set<string> = new Set();
		const nodes = network.nodes;

		const nodeIndex = new NodeIndex(network);
		nodes.forEach((node) => (node.index = nodeIndex.getIndex(node)));

		const nodeMeasurements: NodeMeasurementV2[] = [];
		allSnapShots.forEach((snapShot) => {
			let node = publicKeyToNodeMap.get(snapShot.nodePublicKey.publicKey);

			if (!node) {
				//entity was not returned from crawler, so we mark it as inactive
				//todo: index will be zero, need a better solution here.
				node = snapShot.toNode(networkUpdate.time);
			}

			if (!publicKeys.has(snapShot.nodePublicKey.publicKey)) {
				publicKeys.add(snapShot.nodePublicKey.publicKey);
				const nodeMeasurement = NodeMeasurementV2.fromNode(
					networkUpdate.time,
					snapShot.nodePublicKey,
					node
				);
				nodeMeasurements.push(nodeMeasurement);
			} else {
				const message =
					'Node has multiple active snapshots: ' +
					snapShot.nodePublicKey.publicKey;
				this.logger.error(message);
				this.exceptionLogger.captureException(new Error(message));
			}
		});

		await this.connection.manager.insert(NodeMeasurementV2, nodeMeasurements);
	}
}