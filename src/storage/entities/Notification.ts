import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EventType } from '../../notifications/Event';

@Entity('notification')
export class Notification {
	@PrimaryGeneratedColumn()
	// @ts-ignore
	id: number;

	@Column({ type: 'integer', nullable: false })
	userId: number;

	@Column({
		type: 'enum',
		enum: EventType,
		nullable: false
	})
	eventType: EventType;

	@Column({ type: 'text' })
	target: string;

	@Column({ type: 'timestamptz' })
	sendTime: Date;

	@Column({ type: 'boolean' })
	muteDuringCoolOff = true; //During the cool off period after an event occurs for a target, no new notifications will be sent if set to true;

	constructor(userId: number, type: EventType, target: string, sendTime: Date) {
		this.userId = userId;
		this.eventType = type;
		this.target = target;
		this.sendTime = sendTime;
	}
}