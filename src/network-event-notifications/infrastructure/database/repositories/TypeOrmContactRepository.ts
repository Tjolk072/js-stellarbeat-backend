import { injectable } from 'inversify';
import { EntityRepository, QueryBuilder, Repository } from 'typeorm';
import { Contact } from '../../../domain/contact/Contact';
import { ContactRepository } from '../../../domain/contact/ContactRepository';
import { ContactId } from '../../../domain/contact/ContactId';
import { v4 as uuidv4 } from 'uuid';
import {
	PendingSubscription,
	PendingSubscriptionId
} from '../../../domain/contact/PendingSubscription';
import { ContactPublicReference } from '../../../domain/contact/ContactPublicReference';

@injectable()
@EntityRepository(Contact)
export class TypeOrmContactRepository
	extends Repository<Contact>
	implements ContactRepository
{
	nextIdentity(): ContactId {
		const contactIdResult = ContactId.create(uuidv4());
		if (contactIdResult.isErr()) throw contactIdResult.error;
		return contactIdResult.value;
	}

	nextPendingEventSourceIdentity(): PendingSubscriptionId {
		const pendingSubscriptionIdResult = PendingSubscriptionId.create(uuidv4());
		if (pendingSubscriptionIdResult.isErr())
			throw pendingSubscriptionIdResult.error;
		return pendingSubscriptionIdResult.value;
	}

	async findOneByPendingSubscriptionId(
		pendingSubscriptionId: PendingSubscriptionId
	): Promise<Contact | null> {
		const contact = await super.findOne({
			join: {
				alias: 'contact',
				innerJoin: { pendingSubscription: 'contact.pendingSubscription' }
			},
			where: (qb: any) => {
				qb.where(
					'"pendingSubscription"."pendingSubscriptionIdValue" = :pendingSubscriptionId',
					{ pendingSubscriptionId: pendingSubscriptionId.value }
				);
			}
		});

		return contact ? contact : null;
	}

	async findOneByContactId(contactId: ContactId): Promise<Contact | null> {
		const contact = await super.findOne({
			where: {
				contactId: contactId
			}
		});

		return contact ? contact : null;
	}

	async findOneByPublicReference(
		publicReference: ContactPublicReference
	): Promise<Contact | null> {
		const contact = await super.findOne({
			where: {
				publicReference: publicReference
			}
		});

		return contact ? contact : null;
	}
}
