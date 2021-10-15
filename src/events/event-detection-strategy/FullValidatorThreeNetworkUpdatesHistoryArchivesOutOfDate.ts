import { NodeMeasurementV2Repository } from '../../repositories/NodeMeasurementV2Repository';
import NetworkUpdate from '../../entities/NetworkUpdate';
import { Event, EventType } from '../Event';
import { NodeMeasurementEventDetectionStrategy } from './NodeMeasurementEventDetectionStrategy';

export class FullValidatorThreeNetworkUpdatesHistoryArchivesOutOfDate extends NodeMeasurementEventDetectionStrategy {
	constructor(nodeMeasurementsRepository: NodeMeasurementV2Repository) {
		super(nodeMeasurementsRepository);
	}

	async detect(networkUpdate: NetworkUpdate): Promise<Event[]> {
		return this.detectByType(
			networkUpdate,
			EventType.FullValidatorHistoryArchiveThreeCrawlsOutOfDate,
			'historyOutOfDate',
			3
		);
	}
}
