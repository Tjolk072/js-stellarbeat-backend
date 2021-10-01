import {Network, Node, Organization, QuorumSet} from "@stellarbeat/js-stellar-domain";
import {CrawlerService} from "../../src/services/CrawlerService";
import CrawlV2Service from "../../src/services/CrawlV2Service";
import {PeerNode} from "@stellarbeat/js-stellar-node-crawler";

it('should map peer nodes to nodes', function () {
    const crawlerService = new CrawlerService({} as CrawlV2Service);

    const node = new Node("A", "localhost", 100);
    const missingNode = new Node("B");
    missingNode.isValidating = true;

    const notSuccessfullyConnectedNode = new Node("D");
    notSuccessfullyConnectedNode.ip = "known";
    notSuccessfullyConnectedNode.port = 100;
    notSuccessfullyConnectedNode.active = false;
    notSuccessfullyConnectedNode.isValidating = false;
    notSuccessfullyConnectedNode.overLoaded = true;

    const peerNodeA = new PeerNode("A");
    peerNodeA.ip = "localhost2";
    peerNodeA.port = 100;
    peerNodeA.isValidating = true;
    peerNodeA.latestActiveSlotIndex = "12";
    peerNodeA.overLoaded = true;
    peerNodeA.nodeInfo = {
        networkId: "public",
        versionString: "v1",
        overlayVersion: 1,
        overlayMinVersion: 2,
        ledgerVersion: 3
    }

    const newPeerNode = new PeerNode("C");

    const notSuccessfullyConnectedPeerNode = new PeerNode("D");
    notSuccessfullyConnectedPeerNode.isValidating = true;
    notSuccessfullyConnectedPeerNode.overLoaded = false;

    newPeerNode.ip = "localhost";
    newPeerNode.port = 101;

    const peerNodes = new Map<string, PeerNode>();
    peerNodes.set(peerNodeA.publicKey, peerNodeA);
    peerNodes.set(newPeerNode.publicKey, newPeerNode);
    peerNodes.set(notSuccessfullyConnectedPeerNode.publicKey, notSuccessfullyConnectedPeerNode);

    const {nodes, nodesWithNewIP} = crawlerService.mapPeerNodesToNodes(peerNodes, new Network([node, missingNode, notSuccessfullyConnectedNode]));

    expect(nodes).toHaveLength(4);
    expect(nodesWithNewIP).toHaveLength(2);

    expect(node.ip).toEqual('localhost2');
    expect(node.isValidating).toBeTruthy();
    expect(node.active).toBeTruthy();
    expect(node.overLoaded).toBeTruthy();
    expect(node.networkId).toEqual("public");
    expect(node.versionStr).toEqual("v1");
    expect(node.overlayVersion).toEqual(1);
    expect(node.overlayMinVersion).toEqual(2);
    expect(node.ledgerVersion).toEqual(3);

    expect(missingNode.isValidating).toBeFalsy();
    expect(notSuccessfullyConnectedNode.overLoaded).toBeFalsy();
    expect(notSuccessfullyConnectedNode.active).toBeTruthy();
    expect(notSuccessfullyConnectedNode.isValidating).toBeTruthy();
});

it('should return fallback top tier nodes', function () {
    const crawlerService = new CrawlerService({} as CrawlV2Service);
    const knownNode = new Node("A");
    const network = new Network([knownNode]);
    const fallbackNodeKeys = ["A", "B"];

    const fallbackNodes = crawlerService.getFallbackTopTierNodes(fallbackNodeKeys, network);
    expect(fallbackNodes).toHaveLength(2);
    expect(fallbackNodes.find((node) => node.publicKey === knownNode.publicKey)).toEqual(knownNode);
    expect(fallbackNodes.find((node) => node.publicKey === "B")).toBeInstanceOf(Node);
});

it('should return top tier nodes', function () {
    const network = getNetwork();
    const crawlerService = new CrawlerService({} as CrawlV2Service);
    const topTierNodes = crawlerService.getTopTierNodes(network);
    expect(topTierNodes).toHaveLength(9);
    expect(topTierNodes.pop()).toBeInstanceOf(Node);
});

it('should map top tier nodes to quorumset', function () {
    const network = getNetwork();
    const crawlerService = new CrawlerService({} as CrawlV2Service);
    const qSet = crawlerService.topTierNodesToQuorumSet(crawlerService.getTopTierNodes(network))

    expect(qSet.validators).toHaveLength(0);
    expect(qSet.innerQuorumSets).toHaveLength(3);
    expect(qSet.threshold).toEqual(2);
    const innerQSet = qSet.innerQuorumSets.pop();
    expect(innerQSet).toBeInstanceOf(QuorumSet);
    if(!innerQSet)
        return;
    expect(innerQSet.validators).toHaveLength(3);
    expect(innerQSet.threshold).toEqual(2);
    expect(innerQSet.innerQuorumSets).toHaveLength(0);
});

const getNetwork = () => {
    const networkObject = JSON.parse('{\n' +
        '  "nodes": [\n' +
        '    {\n' +
        '      "publicKey": "sdf1",\n' +
        '      "name": "SDF1",\n' +
        '      "organizationId": "sdf", \n' +
        '      "quorumSet": {\n' +
        '        "threshold": 3,\n' +
        '        "validators": [],\n' +
        '        "innerQuorumSets": [\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "lb1",\n' +
        '              "lb2",\n' +
        '              "lb3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sp1",\n' +
        '              "sp2",\n' +
        '              "sp3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sdf1",\n' +
        '              "sdf2",\n' +
        '              "sdf3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          }\n' +
        '        ]\n' +
        '      },\n' +
        '      "geoData": {\n' +
        '        "countryCode": "N/A",\n' +
        '        "countryName": "N/A"\n' +
        '      },\n' +
        '      "isp": "N/A"\n' +
        '    },\n' +
        '    {\n' +
        '      "publicKey": "sdf2",\n' +
        '      "name": "SDF2",\n' +
        '      "organizationId": "sdf", \n' +
        '      "quorumSet": {\n' +
        '        "threshold": 3,\n' +
        '        "validators": [],\n' +
        '        "innerQuorumSets": [\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "lb1",\n' +
        '              "lb2",\n' +
        '              "lb3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sp1",\n' +
        '              "sp2",\n' +
        '              "sp3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sdf1",\n' +
        '              "sdf2",\n' +
        '              "sdf3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          }\n' +
        '        ]\n' +
        '      },\n' +
        '      "geoData": {\n' +
        '        "countryCode": "N/A",\n' +
        '        "countryName": "N/A"\n' +
        '      },\n' +
        '      "isp": "N/A"\n' +
        '    },\n' +
        '    {\n' +
        '      "publicKey": "sdf3",\n' +
        '      "name": "SDF3",\n' +
        '      "organizationId": "sdf", \n' +
        '      "quorumSet": {\n' +
        '        "threshold": 3,\n' +
        '        "validators": [],\n' +
        '        "innerQuorumSets": [\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "lb1",\n' +
        '              "lb2",\n' +
        '              "lb3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sp1",\n' +
        '              "sp2",\n' +
        '              "sp3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sdf1",\n' +
        '              "sdf2",\n' +
        '              "sdf3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          }\n' +
        '        ]\n' +
        '      },\n' +
        '      "geoData": {\n' +
        '        "countryCode": "N/A",\n' +
        '        "countryName": "N/A"\n' +
        '      },\n' +
        '      "isp": "N/A"\n' +
        '    },\n' +
        '    {\n' +
        '      "publicKey": "lb1",\n' +
        '      "name": "LOBSTR1",\n' +
        '      "organizationId": "lobstr", \n' +
        '      "quorumSet": {\n' +
        '        "threshold": 3,\n' +
        '        "validators": [],\n' +
        '        "innerQuorumSets": [\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "lb1",\n' +
        '              "lb2",\n' +
        '              "lb3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sp1",\n' +
        '              "sp2",\n' +
        '              "sp3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sdf1",\n' +
        '              "sdf2",\n' +
        '              "sdf3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          }\n' +
        '        ]\n' +
        '      },\n' +
        '      "geoData": {\n' +
        '        "countryCode": "N/A",\n' +
        '        "countryName": "N/A"\n' +
        '      },\n' +
        '      "isp": "N/A"\n' +
        '    },\n' +
        '    {\n' +
        '      "publicKey": "lb2",\n' +
        '      "name": "LOBSTR2",\n' +
        '      "organizationId": "lobstr", \n' +
        '      "quorumSet": {\n' +
        '        "threshold": 3,\n' +
        '        "validators": [],\n' +
        '        "innerQuorumSets": [\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "lb1",\n' +
        '              "lb2",\n' +
        '              "lb3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sp1",\n' +
        '              "sp2",\n' +
        '              "sp3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sdf1",\n' +
        '              "sdf2",\n' +
        '              "sdf3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          }\n' +
        '        ]\n' +
        '      },\n' +
        '      "geoData": {\n' +
        '        "countryCode": "N/A",\n' +
        '        "countryName": "N/A"\n' +
        '      },\n' +
        '      "isp": "N/A"\n' +
        '    },\n' +
        '    {\n' +
        '      "publicKey": "lb3",\n' +
        '      "name": "LOBSTR3",\n' +
        '      "organizationId": "lobstr", \n' +
        '      "quorumSet": {\n' +
        '        "threshold": 3,\n' +
        '        "validators": [],\n' +
        '        "innerQuorumSets": [\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "lb1",\n' +
        '              "lb2",\n' +
        '              "lb3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sp1",\n' +
        '              "sp2",\n' +
        '              "sp3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sdf1",\n' +
        '              "sdf2",\n' +
        '              "sdf3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          }\n' +
        '        ]\n' +
        '      },\n' +
        '      "geoData": {\n' +
        '        "countryCode": "N/A",\n' +
        '        "countryName": "N/A"\n' +
        '      },\n' +
        '      "isp": "N/A"\n' +
        '    },\n' +
        '    {\n' +
        '      "publicKey": "sp1",\n' +
        '      "name": "SatoshiPay1",\n' +
        '      "organizationId": "sp", \n' +
        '      "quorumSet": {\n' +
        '        "threshold": 3,\n' +
        '        "validators": [],\n' +
        '        "innerQuorumSets": [\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "lb1",\n' +
        '              "lb2",\n' +
        '              "lb3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sp1",\n' +
        '              "sp2",\n' +
        '              "sp3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sdf1",\n' +
        '              "sdf2",\n' +
        '              "sdf3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          }\n' +
        '        ]\n' +
        '      },\n' +
        '      "geoData": {\n' +
        '        "countryCode": "N/A",\n' +
        '        "countryName": "N/A"\n' +
        '      },\n' +
        '      "isp": "N/A"\n' +
        '    },\n' +
        '    {\n' +
        '      "publicKey": "sp2",\n' +
        '      "name": "SatoshiPay2",\n' +
        '      "organizationId": "sp", \n' +
        '      "quorumSet": {\n' +
        '        "threshold": 3,\n' +
        '        "validators": [],\n' +
        '        "innerQuorumSets": [\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "lb1",\n' +
        '              "lb2",\n' +
        '              "lb3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sp1",\n' +
        '              "sp2",\n' +
        '              "sp3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sdf1",\n' +
        '              "sdf2",\n' +
        '              "sdf3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          }\n' +
        '        ]\n' +
        '      },\n' +
        '      "geoData": {\n' +
        '        "countryCode": "N/A",\n' +
        '        "countryName": "N/A"\n' +
        '      },\n' +
        '      "isp": "N/A"\n' +
        '    },\n' +
        '    {\n' +
        '      "publicKey": "sp3",\n' +
        '      "name": "SatoshiPay3",\n' +
        '      "organizationId": "sp", \n' +
        '      "quorumSet": {\n' +
        '        "threshold": 3,\n' +
        '        "validators": [],\n' +
        '        "innerQuorumSets": [\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "lb1",\n' +
        '              "lb2",\n' +
        '              "lb3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sp1",\n' +
        '              "sp2",\n' +
        '              "sp3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          },\n' +
        '          {\n' +
        '            "threshold": 2,\n' +
        '            "validators": [\n' +
        '              "sdf1",\n' +
        '              "sdf2",\n' +
        '              "sdf3"\n' +
        '            ],\n' +
        '            "innerQuorumSets": []\n' +
        '          }\n' +
        '        ]\n' +
        '      },\n' +
        '      "geoData": {\n' +
        '        "countryCode": "N/A",\n' +
        '        "countryName": "N/A"\n' +
        '      },\n' +
        '      "isp": "N/A"\n' +
        '    }\n' +
        '  ],\n' +
        '  "organizations": [\n' +
        '    {\n' +
        '      "id": "sp",\n' +
        '      "name": "Satoshipay",\n' +
        '      "validators": [\n' +
        '        "sp1",\n' +
        '        "sp2",\n' +
        '        "sp3"\n' +
        '      ]\n' +
        '    },\n' +
        '    {\n' +
        '      "id": "lb",\n' +
        '      "name": "LOBSTR",\n' +
        '      "validators": [\n' +
        '        "lb1",\n' +
        '        "lb2",\n' +
        '        "lb3"\n' +
        '      ]\n' +
        '    },\n' +
        '    {\n' +
        '      "id": "sdf",\n' +
        '      "name": "SDF",\n' +
        '      "validators": [\n' +
        '        "sdf1",\n' +
        '        "sdf2",\n' +
        '        "sdf3"\n' +
        '      ]\n' +
        '    }\n' +
        '  ]\n' +
        '}')
    return new Network(
        networkObject.nodes.map((node: object) => Node.fromJSON(node)),
        networkObject.organizations.map((org: object) => Organization.fromJSON(org))
    );
}