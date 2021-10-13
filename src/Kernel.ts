import { Container, decorate, injectable } from 'inversify';
import {
	Connection,
	createConnection,
	getCustomRepository,
	getRepository,
	Repository
} from 'typeorm';
import { Config } from './Config';
import { NodeMeasurementV2Repository } from './repositories/NodeMeasurementV2Repository';
import { NetworkMeasurementRepository } from './repositories/NetworkMeasurementRepository';
import { CrawlV2Repository } from './repositories/CrawlV2Repository';
import { NetworkMeasurementDayRepository } from './repositories/NetworkMeasurementDayRepository';
import { NetworkMeasurementMonthRepository } from './repositories/NetworkMeasurementMonthRepository';
import { NodeMeasurementDayV2Repository } from './repositories/NodeMeasurementDayV2Repository';
import OrganizationSnapShotRepository from './repositories/OrganizationSnapShotRepository';
import NodeSnapShotRepository from './repositories/NodeSnapShotRepository';
import { OrganizationMeasurementDayRepository } from './repositories/OrganizationMeasurementDayRepository';
import { OrganizationMeasurementRepository } from './repositories/OrganizationMeasurementRepository';
import NodePublicKeyStorage, {
	NodePublicKeyStorageRepository
} from './entities/NodePublicKeyStorage';
import OrganizationIdStorage, {
	OrganizationIdStorageRepository
} from './entities/OrganizationIdStorage';
import MeasurementRollup from './entities/MeasurementRollup';
import OrganizationMeasurement from './entities/OrganizationMeasurement';
import NetworkMeasurement from './entities/NetworkMeasurement';
import NodeGeoDataStorage from './entities/NodeGeoDataStorage';
import NodeQuorumSetStorage from './entities/NodeQuorumSetStorage';
import SnapShotter from './services/SnapShotting/SnapShotter';
import NodeSnapShotter from './services/SnapShotting/NodeSnapShotter';
import OrganizationSnapShotter from './services/SnapShotting/OrganizationSnapShotter';
import NodeSnapShotArchiver from './services/NodeSnapShotArchiver';
import { CrawlResultProcessor } from './services/CrawlResultProcessor';
import NetworkService from './services/NetworkService';
import { CrawlerService } from './services/CrawlerService';
import NodeMeasurementService from './services/NodeMeasurementService';
import OrganizationMeasurementService from './services/OrganizationMeasurementService';
import MeasurementsRollupService from './services/MeasurementsRollupService';
import FbasAnalyzerService from './services/FbasAnalyzerService';
import NodeSnapShotFactory from './factory/NodeSnapShotFactory';
import OrganizationSnapShotFactory from './factory/OrganizationSnapShotFactory';
import { HorizonService } from './services/HorizonService';
import { HomeDomainUpdater } from './services/HomeDomainUpdater';
import { TomlService } from './services/TomlService';
import { HistoryService } from './services/HistoryService';
import {
	GeoDataService,
	IpStackGeoDataService
} from './services/IpStackGeoDataService';
import { FullValidatorDetector } from './services/FullValidatorDetector';
import {
	DummyJSONArchiver,
	JSONArchiver,
	S3Archiver
} from './services/S3Archiver';
import {
	DeadManSnitchHeartBeater,
	DummyHeartBeater,
	HeartBeater
} from './services/DeadManSnitchHeartBeater';
import { APICacheClearer } from './services/APICacheClearer';
import {
	ConsoleExceptionLogger,
	ExceptionLogger,
	SentryExceptionLogger
} from './services/ExceptionLogger';
import { NetworkUpdater } from './NetworkUpdater';
import { AxiosHttpService, HttpService } from './services/HttpService';
import { createCrawler } from '@stellarbeat/js-stellar-node-crawler';
import { Logger, PinoLogger } from './services/PinoLogger';

export default class Kernel {
	protected _container?: Container;

	constructor() {
		decorate(injectable(), Repository);
		decorate(injectable(), Connection);
	}

	async initializeContainer(config: Config): Promise<void> {
		this._container = new Container();
		await this.loadAsync(config);
		this.load(config);
	}

	get container(): Container {
		if (this._container === undefined)
			throw new Error('Kernel not initialized');

		return this._container;
	}

	async shutdown() {
		const connection = this.container.get(Connection);
		await connection.close();
	}

	async loadAsync(config: Config) {
		let connectionName: string | undefined = undefined;
		let connection: Connection;
		if (config.nodeEnv === 'test') {
			connectionName = 'test';
			connection = await createConnection(connectionName);
		} else connection = await createConnection();

		this.container
			.bind<Connection>(Connection)
			.toDynamicValue(() => {
				return connection;
			})
			.inRequestScope();
		this.container
			.bind<NodeMeasurementV2Repository>(NodeMeasurementV2Repository)
			.toDynamicValue(() => {
				return getCustomRepository(NodeMeasurementV2Repository, connectionName);
			})
			.inRequestScope();
		this.container
			.bind<NetworkMeasurementRepository>(NetworkMeasurementRepository)
			.toDynamicValue(() => {
				return getCustomRepository(
					NetworkMeasurementRepository,
					connectionName
				);
			})
			.inRequestScope();
		this.container
			.bind<CrawlV2Repository>(CrawlV2Repository)
			.toDynamicValue(() => {
				return getCustomRepository(CrawlV2Repository, connectionName);
			})
			.inRequestScope();
		this.container
			.bind<NetworkMeasurementDayRepository>(NetworkMeasurementDayRepository)
			.toDynamicValue(() => {
				return getCustomRepository(
					NetworkMeasurementDayRepository,
					connectionName
				);
			})
			.inRequestScope();
		this.container
			.bind<NetworkMeasurementMonthRepository>(
				NetworkMeasurementMonthRepository
			)
			.toDynamicValue(() => {
				return getCustomRepository(
					NetworkMeasurementMonthRepository,
					connectionName
				);
			})
			.inRequestScope();
		this.container
			.bind<NodeMeasurementDayV2Repository>(NodeMeasurementDayV2Repository)
			.toDynamicValue(() => {
				return getCustomRepository(
					NodeMeasurementDayV2Repository,
					connectionName
				);
			})
			.inRequestScope();
		this.container
			.bind<OrganizationSnapShotRepository>(OrganizationSnapShotRepository)
			.toDynamicValue(() => {
				return getCustomRepository(
					OrganizationSnapShotRepository,
					connectionName
				);
			})
			.inRequestScope();
		this.container
			.bind<NodeSnapShotRepository>(NodeSnapShotRepository)
			.toDynamicValue(() => {
				return getCustomRepository(NodeSnapShotRepository, connectionName);
			})
			.inRequestScope();
		this.container
			.bind<OrganizationMeasurementDayRepository>(
				OrganizationMeasurementDayRepository
			)
			.toDynamicValue(() => {
				return getCustomRepository(
					OrganizationMeasurementDayRepository,
					connectionName
				);
			})
			.inRequestScope();
		this.container
			.bind<OrganizationMeasurementRepository>(
				OrganizationMeasurementRepository
			)
			.toDynamicValue(() => {
				return getCustomRepository(
					OrganizationMeasurementRepository,
					connectionName
				);
			})
			.inRequestScope();
		this.container
			.bind<NodePublicKeyStorageRepository>('NodePublicKeyStorageRepository')
			.toDynamicValue(() => {
				return getRepository(NodePublicKeyStorage, connectionName);
			})
			.inRequestScope();
		this.container
			.bind<OrganizationIdStorageRepository>('OrganizationIdStorageRepository')
			.toDynamicValue(() => {
				return getRepository(OrganizationIdStorage, connectionName);
			})
			.inRequestScope();
		this.container
			.bind<Repository<MeasurementRollup>>('Repository<MeasurementRollup>')
			.toDynamicValue(() => {
				return getRepository(MeasurementRollup, connectionName);
			})
			.inRequestScope();
		this.container
			.bind<Repository<OrganizationMeasurement>>(
				'Repository<OrganizationMeasurement>'
			)
			.toDynamicValue(() => {
				return getRepository(OrganizationMeasurement, connectionName);
			})
			.inRequestScope();
		this.container
			.bind<Repository<NetworkMeasurement>>('Repository<NetworkMeasurement>')
			.toDynamicValue(() => {
				return getRepository(NetworkMeasurement, connectionName);
			})
			.inRequestScope();
		this.container
			.bind<Repository<NodeGeoDataStorage>>('Repository<NodeGeoDataStorage>')
			.toDynamicValue(() => {
				return getRepository(NodeGeoDataStorage, connectionName);
			})
			.inRequestScope();
		this.container
			.bind<Repository<NodeQuorumSetStorage>>(
				'Repository<NodeQuorumSetStorage>'
			)
			.toDynamicValue(() => {
				return getRepository(NodeQuorumSetStorage, connectionName);
			})
			.inRequestScope();
	}

	load(config: Config) {
		this.container.bind<HttpService>('HttpService').toDynamicValue(() => {
			return new AxiosHttpService(config.userAgent);
		});
		this.container.bind<SnapShotter>(SnapShotter).toSelf();
		this.container.bind<NodeSnapShotter>(NodeSnapShotter).toSelf();
		this.container
			.bind<OrganizationSnapShotter>(OrganizationSnapShotter)
			.toSelf();
		this.container.bind<NodeSnapShotArchiver>(NodeSnapShotArchiver).toSelf();
		this.container.bind<CrawlResultProcessor>(CrawlResultProcessor).toSelf();
		this.container.bind<NetworkService>(NetworkService).toSelf();
		this.container.bind<CrawlerService>(CrawlerService).toDynamicValue(() => {
			const crawler = createCrawler(config.crawlerConfig); //todo logger
			return new CrawlerService(
				config.topTierFallback,
				crawler,
				this.container.get<Logger>('Logger')
			);
		});
		this.container
			.bind<NodeMeasurementService>(NodeMeasurementService)
			.toSelf();
		this.container
			.bind<OrganizationMeasurementService>(OrganizationMeasurementService)
			.toSelf();
		this.container
			.bind<MeasurementsRollupService>(MeasurementsRollupService)
			.toSelf();
		this.container.bind<FbasAnalyzerService>(FbasAnalyzerService).toSelf();
		this.container.bind<NodeSnapShotFactory>(NodeSnapShotFactory).toSelf();
		this.container
			.bind<OrganizationSnapShotFactory>(OrganizationSnapShotFactory)
			.toSelf();
		this.container.bind<HorizonService>(HorizonService).toDynamicValue(() => {
			return new HorizonService(
				this.container.get<HttpService>('HttpService'),
				config.horizonUrl
			);
		});
		this.container.bind<HomeDomainUpdater>(HomeDomainUpdater).toSelf();
		this.container.bind<TomlService>(TomlService).toSelf();
		this.container.bind<HistoryService>(HistoryService).toSelf();

		this.container.bind<GeoDataService>('GeoDataService').toDynamicValue(() => {
			return new IpStackGeoDataService(
				this.container.get<Logger>('Logger'),
				this.container.get<HttpService>('HttpService'),
				config.ipStackAccessKey
			);
		});

		this.container.bind<FullValidatorDetector>(FullValidatorDetector).toSelf();
		this.container.bind<JSONArchiver>('JSONArchiver').toDynamicValue(() => {
			if (
				config.enableS3Backup &&
				config.s3Secret &&
				config.s3AccessKeyId &&
				config.s3BucketName
			)
				return new S3Archiver(
					config.s3AccessKeyId,
					config.s3Secret,
					config.s3BucketName,
					config.nodeEnv
				);
			return new DummyJSONArchiver(this.container.get<Logger>('Logger'));
		});
		this.container.bind<HeartBeater>('HeartBeater').toDynamicValue(() => {
			if (config.enableDeadManSwitch && config.deadManSwitchUrl)
				return new DeadManSnitchHeartBeater(
					this.container.get<HttpService>('HttpService'),
					config.deadManSwitchUrl
				);
			return new DummyHeartBeater();
		});

		this.container.bind<APICacheClearer>(APICacheClearer).toDynamicValue(() => {
			return new APICacheClearer(
				this.container.get<HttpService>('HttpService'),
				config.apiCacheClearUrl
			);
		});

		this.container
			.bind<ExceptionLogger>('ExceptionLogger')
			.toDynamicValue(() => {
				if (config.enableSentry && config.sentryDSN)
					return new SentryExceptionLogger(config.sentryDSN);
				else return new ConsoleExceptionLogger();
			});
		this.container.bind<NetworkUpdater>(NetworkUpdater).toDynamicValue(() => {
			return new NetworkUpdater(
				config.loop,
				this.container.get(NetworkService),
				this.container.get(CrawlResultProcessor),
				this.container.get(CrawlerService),
				this.container.get(HomeDomainUpdater),
				this.container.get(TomlService),
				this.container.get<GeoDataService>('GeoDataService'),
				this.container.get(FullValidatorDetector),
				this.container.get<JSONArchiver>('JSONArchiver'),
				this.container.get(APICacheClearer),
				this.container.get<HeartBeater>('HeartBeater'),
				this.container.get<ExceptionLogger>('ExceptionLogger'),
				this.container.get<Logger>('Logger')
			);
		});
		this.container.bind<Logger>('Logger').to(PinoLogger);
	}
}
