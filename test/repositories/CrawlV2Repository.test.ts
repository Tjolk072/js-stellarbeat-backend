import { Container } from 'inversify';
import Kernel from '../../src/Kernel';
import { Connection } from 'typeorm';
import { CrawlV2Repository } from '../../src/repositories/CrawlV2Repository';
import CrawlV2 from '../../src/entities/CrawlV2';
import { ConfigMock } from '../configMock';

describe('test queries', () => {
	let container: Container;
	const kernel = new Kernel();
	let crawlRepository: CrawlV2Repository;
	jest.setTimeout(60000); //slow integration tests

	beforeEach(async () => {
		await kernel.initializeContainer(new ConfigMock());
		container = kernel.container;
		crawlRepository = container.get(CrawlV2Repository);
	});

	afterEach(async () => {
		await container.get(Connection).close();
	});

	it('should store latestLedger correctly', async function () {
		const crawl = new CrawlV2(new Date(), []);
		crawl.latestLedger = BigInt(100);

		await crawlRepository.save(crawl);

		const fetchedCrawl = await crawlRepository.findOne(1);
		expect(fetchedCrawl).toBeDefined();
		if (!fetchedCrawl) return;
		expect(fetchedCrawl.latestLedger).toEqual(crawl.latestLedger);
		expect(typeof fetchedCrawl.latestLedger).toEqual('bigint');
		expect(fetchedCrawl.latestLedgerCloseTime.getTime()).toEqual(
			new Date(0).getTime()
		);
	});
});
