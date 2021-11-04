import { Contact } from '../Contact';
import {
	SourceType,
	ValidatorXUpdatesNotValidatingEvent
} from '../../event/Event';
import { EventSourceSubscription } from '../EventSourceSubscription';
import { ContactId } from '../ContactId';

describe('Latest notification creation', function () {
	it('should create notifications for subscribed events', function () {
		const time = new Date();
		const subscription = EventSourceSubscription.create({
			sourceType: SourceType.Node,
			sourceId: 'A',
			latestNotifications: []
		});
		const contact = Contact.create({
			contactId: new ContactId('id'),
			mailHash: 'mail',
			subscriptions: [subscription]
		});

		const event = new ValidatorXUpdatesNotValidatingEvent(time, 'A', {
			numberOfUpdates: 3
		});

		const contactNotification = contact.publishNotificationAbout([event]);
		expect(contactNotification?.events).toHaveLength(1);
		expect(contactNotification?.events[0]).toEqual(event);
	});

	it('should not create notifications if the contact is not subscribed to the event', function () {
		const time = new Date();
		const subscription = EventSourceSubscription.create({
			sourceType: SourceType.Organization,
			sourceId: 'A',
			latestNotifications: []
		});

		const contact = Contact.create({
			contactId: new ContactId('id'),
			mailHash: 'mail',
			subscriptions: [subscription]
		});
		const event = new ValidatorXUpdatesNotValidatingEvent(time, 'A', {
			numberOfUpdates: 3
		});

		expect(contact.publishNotificationAbout([event])).toBeNull();
	});
});

describe('CoolOffPeriod handling', function () {
	let subscription: EventSourceSubscription;
	let contact: Contact;
	beforeEach(() => {
		subscription = EventSourceSubscription.create({
			sourceType: SourceType.Node,
			sourceId: 'A',
			latestNotifications: []
		});

		contact = Contact.create({
			contactId: new ContactId('id'),
			mailHash: 'mail',
			subscriptions: [subscription]
		});
	});

	it('should create notification if the previous notification for the event type was more then coolOf time ago', function () {
		const time = new Date();
		const previousTime = new Date(
			new Date().getTime() - EventSourceSubscription.CoolOffPeriod - 1
		);

		const previousEvent = new ValidatorXUpdatesNotValidatingEvent(
			previousTime,
			'A',
			{
				numberOfUpdates: 3
			}
		);
		contact.publishNotificationAbout([previousEvent]);

		const event = new ValidatorXUpdatesNotValidatingEvent(time, 'A', {
			numberOfUpdates: 3
		});
		const contactNotification = contact.publishNotificationAbout([event]);

		expect(subscription.latestNotifications).toHaveLength(1);
		expect(contactNotification?.events).toHaveLength(1);
	});

	it('should not create a notification if a previous notification with same source and event type was created less then the coolOff period ago', function () {
		const time = new Date();
		const previousTime = new Date(
			time.getTime() - EventSourceSubscription.CoolOffPeriod + 1
		);
		const previousEvent = new ValidatorXUpdatesNotValidatingEvent(
			previousTime,
			'A',
			{
				numberOfUpdates: 3
			}
		);

		contact.publishNotificationAbout([previousEvent]);

		const event = new ValidatorXUpdatesNotValidatingEvent(time, 'A', {
			numberOfUpdates: 3
		});

		expect(contact.publishNotificationAbout([event])).toBeNull();
	});
});