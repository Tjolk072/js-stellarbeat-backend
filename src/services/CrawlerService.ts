import { err, ok, Result } from 'neverthrow';
import { Crawler, PeerNode } from '@stellarbeat/js-stellar-node-crawler';
import {
	Network,
	Node,
	Organization,
	QuorumSet
} from '@stellarbeat/js-stellar-domain';
import {
	Ledger,
	NodeAddress
} from '@stellarbeat/js-stellar-node-crawler/lib/crawler';
import { injectable } from 'inversify';
import CrawlV2Service from './CrawlV2Service';
import * as net from 'net';

export type CrawlResult = {
	nodes: Node[];
	nodesWithNewIP: Node[];
	organizations: Organization[];
	latestClosedLedger: Ledger;
	processedLedgers: number[];
};

/**
 * Uses the crawler package to perform a new crawl based on seed data in our database
 */
@injectable()
export class CrawlerService {
	constructor(
		protected topTierFallback: string[],
		protected crawlService: CrawlV2Service,
		protected crawler: Crawler
	) {
		this.crawlService = crawlService;
		this.crawler = crawler;
	}

	async crawl(): Promise<Result<CrawlResult, Error>> {
		try {
			const latestCrawlResult = await this.crawlService.getCrawlAt(new Date());
			if (latestCrawlResult.isErr()) {
				return err(latestCrawlResult.error);
			}
			const latestCrawl = latestCrawlResult.value;
			let latestClosedLedger: Ledger = {
				sequence: latestCrawl.latestLedger,
				closeTime: latestCrawl.time
			};
			console.log(
				'[MAIN] latest detected ledger of previous crawl: ' +
					latestCrawl.latestLedger.toString()
			);

			const network = new Network(latestCrawl.nodes, latestCrawl.organizations);

			if (network.nodes.length === 0) {
				return err(new Error('Cannot crawl network without nodes'));
			}

			let topTierNodes = this.getTopTierNodes(network);
			if (topTierNodes.length === 0)
				topTierNodes = this.getFallbackTopTierNodes(network);

			const addresses: NodeAddress[] = [];
			const quorumSets: Map<string, QuorumSet> = new Map();

			// crawl the top tier nodes first. If for some reason nodes are not sending the externalize messages of other nodes they depend on,
			// we can at least pick up the own messages of the top tier because the crawler will connect to them simultaneously and keep listening until timeout or a ledger close.
			// Edge case: most of the top tiers are overloaded and we cannot connect to them: without relay of externalize messages we also cannot find out if the nodes are validating.
			// Edge case: If the top tier nodes are validating but do not even send their own externalize messages to us, then there is no way we can determine their validating status.
			// For maximum robustness the max open connections setting is advised to be at least the number of top tier nodes.
			const sortedNodes = network.nodes.sort((a, b) => {
				if (topTierNodes.includes(a)) return -1;
				return 0;
			});

			sortedNodes.map((node) => {
				addresses.push([node.ip, node.port]);
				if (node.quorumSetHashKey)
					quorumSets.set(node.quorumSetHashKey, node.quorumSet);
			});

			const crawlResult = await this.crawler.crawl(
				addresses,
				this.topTierNodesToQuorumSet(topTierNodes),
				latestClosedLedger,
				quorumSets
			);

			if (
				Array.from(crawlResult.peers.values()).filter(
					(peer) => peer.successfullyConnected
				).length === 0
			)
				return err(new Error('Could not connect to a single node in crawl'));
			const { nodes, nodesWithNewIP } = this.mapPeerNodesToNodes(
				crawlResult.peers,
				network
			);

			const processedLedgers = crawlResult.closedLedgers.map((sequence) =>
				Number(sequence)
			);
			latestClosedLedger = crawlResult.latestClosedLedger;

			return ok({
				nodes: nodes,
				organizations: network.organizations,
				nodesWithNewIP: nodesWithNewIP,
				latestClosedLedger: latestClosedLedger,
				processedLedgers: processedLedgers
			});
		} catch (e) {
			if (e instanceof Error) return err(e);
			return err(new Error('Unspecified error during crawl'));
		}
	}

	public mapPeerNodesToNodes(
		peerNodes: Map<string, PeerNode>,
		network: Network
	): { nodes: Node[]; nodesWithNewIP: Node[] } {
		const nodesWithNewIp: Node[] = [];
		const nodes: Node[] = [];
		const publicKeys: Set<string> = new Set();
		peerNodes.forEach((peer) => {
			publicKeys.add(peer.publicKey);

			const node = network.getNodeByPublicKey(peer.publicKey);

			if (peer.ip && peer.port) {
				if (node.ip !== peer.ip) nodesWithNewIp.push(node);

				node.ip = peer.ip;
				node.port = peer.port;
			}

			if (peer.quorumSet) {
				//to make sure we dont override qSets just because the node was not validating this round.
				node.quorumSet = peer.quorumSet;
				node.quorumSetHashKey = peer.quorumSetHash ? peer.quorumSetHash : null;
			}

			node.isValidating = peer.isValidating;
			node.overLoaded = peer.overLoaded;
			node.activeInScp = peer.participatingInSCP;
			node.active = true;

			//todo: participating in scp
			if (peer.nodeInfo) {
				node.ledgerVersion = peer.nodeInfo.ledgerVersion;
				node.overlayMinVersion = peer.nodeInfo.overlayMinVersion;
				node.overlayVersion = peer.nodeInfo.overlayVersion;
				node.versionStr = peer.nodeInfo.versionString;
				node.networkId = peer.nodeInfo.networkId
					? peer.nodeInfo.networkId
					: null;
			}

			nodes.push(node);
		});

		network.nodes
			.filter((node) => !publicKeys.has(node.publicKey))
			.forEach((node) => {
				node.overLoaded = false;
				node.active = false;
				node.isValidating = false;
				nodes.push(node);
			});

		return {
			nodes: nodes,
			nodesWithNewIP: nodesWithNewIp
		};
	}

	//todo: move to network
	getTopTierNodes(network: Network) {
		return network.nodes.filter((node) =>
			network.nodesTrustGraph.isVertexPartOfNetworkTransitiveQuorumSet(
				node.publicKey
			)
		);
	}

	getFallbackTopTierNodes(network: Network) {
		return this.topTierFallback.map((publicKey) =>
			network.getNodeByPublicKey(publicKey)
		);
	}

	topTierNodesToQuorumSet(topTierNodes: Node[]) {
		const organizations: Map<string, Node[]> = new Map<string, Node[]>();
		const validatorsWithoutOrganizations: Node[] = [];
		topTierNodes.forEach((node) => {
			if (!node.organizationId) validatorsWithoutOrganizations.push(node);
			else {
				let orgNodes = organizations.get(node.organizationId);
				if (!orgNodes) orgNodes = [];
				orgNodes.push(node);
				organizations.set(node.organizationId, orgNodes);
			}
		});

		const quorumSet = new QuorumSet();
		quorumSet.validators = validatorsWithoutOrganizations.map((node) => {
			return node.publicKey;
		});

		organizations.forEach((nodes) => {
			const innerQSet = new QuorumSet();
			innerQSet.validators = nodes.map((node) => node.publicKey);
			innerQSet.threshold = Math.floor(innerQSet.validators.length / 2) + 1;
			quorumSet.innerQuorumSets.push(innerQSet);
		});

		quorumSet.threshold =
			Math.floor(
				(quorumSet.validators.length + quorumSet.innerQuorumSets.length) / 2
			) + 1;

		return quorumSet;
	}
}
