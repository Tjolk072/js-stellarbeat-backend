import {Container} from "inversify";
import Kernel from "../../src/Kernel";
import {Connection} from "typeorm";
import {Node} from "@stellarbeat/js-stellar-domain";
import NodeSnapShotFactory from "../../src/factory/NodeSnapShotFactory";
import NodePublicKeyStorage, {NodePublicKeyStorageRepository} from "../../src/entities/NodePublicKeyStorage";
import NodeSnapShotRepository from "../../src/repositories/NodeSnapShotRepository";
import NodeMeasurementV2 from "../../src/entities/NodeMeasurementV2";
import NodeSnapShot from "../../src/entities/NodeSnapShot";
import {NodeMeasurementV2Repository} from "../../src/repositories/NodeMeasurementV2Repository";

describe('test queries', () => {
    let container: Container;
    const kernel = new Kernel();
    let nodeSnapShotRepository: NodeSnapShotRepository;
    let nodeMeasurementV2Repository: NodeMeasurementV2Repository;
    let nodePublicKeyStorageRepository: NodePublicKeyStorageRepository;
    jest.setTimeout(160000); //slow integration tests

    beforeEach(async () => {
        await kernel.initializeContainer();
        container = kernel.container;
        nodeSnapShotRepository = container.get(NodeSnapShotRepository);
        nodePublicKeyStorageRepository = container.get('NodePublicKeyStorageRepository');
        nodeMeasurementV2Repository = container.get(NodeMeasurementV2Repository);
    })

    afterEach(async () => {
        await container.get(Connection).close();
    });

    test('findLatest', async () => {
        const node = new Node('a')
        node.quorumSet.threshold = 1;
        node.quorumSet.hashKey = 'hash';
        node.quorumSet.validators.push('a');
        node.geoData.countryCode = 'US';
        node.geoData.countryName = 'United States';
        node.geoData.longitude = 1;
        node.geoData.latitude = 1;
        node.versionStr = 'v1';
        const nodeSnapShotFactory = container.get(NodeSnapShotFactory);
        const publicKeyStorage = new NodePublicKeyStorage(node.publicKey!);
        const initialDate = new Date();
        const snapshot1 = nodeSnapShotFactory.create(publicKeyStorage, node, initialDate);
        const otherNode = new Node('b');
        otherNode.quorumSet.threshold = 1;
        otherNode.quorumSet.hashKey = 'hash';
        otherNode.quorumSet.validators.push('a');
        const irrelevantSnapshot = nodeSnapShotFactory.create(new NodePublicKeyStorage(otherNode.publicKey!), otherNode, initialDate);
        await nodeSnapShotRepository.save([snapshot1, irrelevantSnapshot]);
        snapshot1.id = 1; //typeorm bug: doesn't update id...
        node.versionStr = 'v2';
        const updatedDate = new Date();
        const snapShot2 = nodeSnapShotFactory.createUpdatedSnapShot(snapshot1, node, updatedDate, null);
        await nodeSnapShotRepository.save([snapshot1, snapShot2]);
        let snapShots = await nodeSnapShotRepository.findLatestByNode(publicKeyStorage);
        expect(snapShots.length).toEqual(2);
        expect(snapShots[0]!.nodeDetails!.versionStr).toEqual('v2');
        expect(snapShots[1]!.nodeDetails!.versionStr).toEqual('v1');

        snapShots = await nodeSnapShotRepository.findLatestByNode(publicKeyStorage, initialDate);
        expect(snapShots.length).toEqual(1);
        expect(snapShots[0]!.nodeDetails!.versionStr).toEqual('v1');
        const networkSnapShots = await nodeSnapShotRepository.findLatest(initialDate);
        expect(networkSnapShots).toHaveLength(2);
    });

    test('archiveInActiveWithMultipleIpSamePort', async () => {
        const nodePublicKeyStorageToBeArchived = new NodePublicKeyStorage("a");
        nodePublicKeyStorageToBeArchived.id = 1;
        const nodePublicKeyStorageActive = new NodePublicKeyStorage("b");
        nodePublicKeyStorageActive.id = 2;
        const nodePublicKeyArchived = new NodePublicKeyStorage("c");
        nodePublicKeyArchived.id = 3;
        const nodePublicKeyStorageToBeLeftAlone = new NodePublicKeyStorage("d");
        nodePublicKeyStorageToBeLeftAlone.id = 4;
        const nodePublicKeyStorageSameIpDifferentPort = new NodePublicKeyStorage("e");
        nodePublicKeyStorageSameIpDifferentPort.id = 5;
        await nodePublicKeyStorageRepository.save([nodePublicKeyStorageToBeArchived, nodePublicKeyStorageToBeLeftAlone, nodePublicKeyStorageSameIpDifferentPort, nodePublicKeyStorageActive, nodePublicKeyArchived])

        const crawlTime = new Date();
        const measurement = new NodeMeasurementV2(crawlTime, nodePublicKeyStorageToBeArchived);
        measurement.isActive = false;
        const measurementActive = new NodeMeasurementV2(crawlTime, nodePublicKeyStorageActive);
        measurementActive.isActive = true;
        const measurementArchived = new NodeMeasurementV2(crawlTime, nodePublicKeyArchived); //would not have measurement, but lets make sure it remains untouched.
        measurementArchived.isActive = false;
        const measurementToBeLeftAlone = new NodeMeasurementV2(crawlTime, nodePublicKeyStorageToBeLeftAlone);
        measurementToBeLeftAlone.isActive = false;
        const measurementSameIpDifferentPort = new NodeMeasurementV2(crawlTime, nodePublicKeyStorageSameIpDifferentPort);
        measurementSameIpDifferentPort.isActive = false;
        await nodeMeasurementV2Repository.save([measurement, measurementActive, measurementArchived, measurementToBeLeftAlone, measurementSameIpDifferentPort]);


        const nodeSnapshotToBeArchived = new NodeSnapShot(nodePublicKeyStorageToBeArchived, new Date(), '127.0.0.1', 80);
        const nodeSnapshotActive = new NodeSnapShot(nodePublicKeyStorageActive, new Date(), '127.0.0.1', 80);
        const nodeSnapshotAlreadyArchived = new NodeSnapShot(nodePublicKeyArchived, new Date(), '127.0.0.1', 80);
        nodeSnapshotAlreadyArchived.endDate = new Date();
        const nodeSnapshotToBeLeftAlone = new NodeSnapShot(nodePublicKeyStorageToBeLeftAlone, new Date(), 'otherhost', 80);
        const nodeSnapShotSameIpOtherPort = new NodeSnapShot(nodePublicKeyStorageSameIpDifferentPort, new Date(), '127.0.0.1', 81);

        await nodeSnapShotRepository.save([
            nodeSnapshotActive, nodeSnapshotAlreadyArchived, nodeSnapshotToBeArchived, nodeSnapshotToBeLeftAlone, nodeSnapShotSameIpOtherPort
        ])

        await nodeSnapShotRepository.archiveInActiveWithMultipleIpSamePort( crawlTime);
        const activeSnapshots = await nodeSnapShotRepository.findActive();
        expect(activeSnapshots.length).toEqual(3);
        const archivedNodes = await nodeSnapShotRepository.find({where: {'endDate': crawlTime}});
        expect(archivedNodes.length).toEqual(1);
        expect(archivedNodes[0]!.nodePublicKey.publicKey).toEqual("a");
    })
})
