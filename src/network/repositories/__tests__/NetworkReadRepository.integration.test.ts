import { Container } from 'inversify';
import Kernel from '../../../shared/core/Kernel';
import NetworkReadRepository from '../NetworkReadRepository';
import { NetworkWriteRepository } from '../NetworkWriteRepository';
import { ConfigMock } from '../../../config/__mocks__/configMock';
import { Network, Node } from '@stellarbeat/js-stellar-domain';
import { Connection } from 'typeorm';
import NetworkUpdate from '../../domain/NetworkUpdate';
import { NetworkUpdateRepository } from '../../infrastructure/database/repositories/NetworkUpdateRepository';

let container: Container;
const kernel = new Kernel();
let networkReadRepository: NetworkReadRepository;
let networkWriteRepository: NetworkWriteRepository;
jest.setTimeout(60000); //slow integration tests

beforeEach(async () => {
	await kernel.initializeContainer(new ConfigMock());
	container = kernel.container;
	networkWriteRepository = kernel.container.get(NetworkWriteRepository);
	networkReadRepository = container.get(NetworkReadRepository);
});

afterEach(async () => {
	await container.get(Connection).close();
});

it('should find the current network but not the previous network when only one network update is available', async function () {
	const updateTime = new Date();
	const node = new Node('A');
	node.active = true;

	await networkWriteRepository.save(
		new NetworkUpdate(updateTime),
		new Network([node])
	);

	const networkResult = await networkReadRepository.getNetwork(updateTime);
	expect(networkResult.isOk()).toBeTruthy();
	if (networkResult.isErr()) return;
	expect(networkResult.value).toBeInstanceOf(Network);
	expect(networkResult.value?.getNodeByPublicKey('A').unknown).toBeFalsy();

	const previousNetworkResult = await networkReadRepository.getPreviousNetwork(
		updateTime
	);
	expect(previousNetworkResult.isOk()).toBeTruthy();
	if (previousNetworkResult.isErr()) return;
	expect(previousNetworkResult.value).toBeNull();
});

it('should find the previous network', async function () {
	const updateTime = new Date();
	const node = new Node('A');
	node.active = true;

	await networkWriteRepository.save(
		new NetworkUpdate(updateTime),
		new Network([node])
	);

	const secondUpdateTime = new Date();
	await networkWriteRepository.save(
		new NetworkUpdate(secondUpdateTime),
		new Network([node])
	);

	const networkResult = await networkReadRepository.getNetwork(
		secondUpdateTime
	);

	expect(networkResult.isOk()).toBeTruthy();
	if (networkResult.isErr()) return;
	expect(networkResult.value).toBeInstanceOf(Network);
	expect(networkResult.value?.getNodeByPublicKey('A').unknown).toBeFalsy();

	const previousNetworkResult = await networkReadRepository.getPreviousNetwork(
		secondUpdateTime
	);
	expect(previousNetworkResult.isOk()).toBeTruthy();
	if (previousNetworkResult.isErr()) return;
	expect(previousNetworkResult.value).toBeInstanceOf(Network);
	expect(previousNetworkResult.value?.time).toEqual(updateTime);
});

it('should cache', async function () {
	const updateTime = new Date();
	const node = new Node('A');
	node.active = true;

	await networkWriteRepository.save(
		new NetworkUpdate(updateTime),
		new Network([node])
	);

	const networkResult = await networkReadRepository.getNetwork(updateTime);
	expect(networkResult.isOk()).toBeTruthy();
	if (networkResult.isErr()) return;

	const networkUpdateRepository = container.get(NetworkUpdateRepository);
	const update = await networkUpdateRepository.findLatest();
	expect(update).toBeDefined();
	if (!update) return;
	await networkUpdateRepository.delete(1);

	const cachedNetworkResult = await networkReadRepository.getNetwork(
		updateTime
	);
	expect(cachedNetworkResult.isOk()).toBeTruthy();
	if (cachedNetworkResult.isErr()) return;
	expect(cachedNetworkResult.value).toBeInstanceOf(Network);
});