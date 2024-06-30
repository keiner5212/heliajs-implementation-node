import express from "express";
import { FsBlockstore } from "blockstore-fs";
import { FsDatastore } from "datastore-fs";
import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { identify, identifyPush } from "@libp2p/identify";
import { autoNAT } from "@libp2p/autonat";
import { dcutr } from "@libp2p/dcutr";
import { kadDHT, removePrivateAddressesMapper } from "@libp2p/kad-dht";
import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import morgan from "morgan";

import debug from "debug";
import { CID } from "multiformats";
import { peerIdFromString } from "@libp2p/peer-id";

const log = debug("heliajs-implementation-node");
debug.enable(
	"*,-libp2p:connection-manager:auto-dial:error,-libp2p:identify-push,-libp2p:identify, -libp2p:connection-manager:auto-dial,-libp2p:connection-manager:dial-queue,-libp2p:connection-manager:dial-queue:error, -libp2p:connection-manager"
);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

const blockstore = new FsBlockstore("./ipfs/blockstore-hello-app");
const datastore = new FsDatastore("./ipfs/datastore-hello-app");

// const libp2p = await createLibp2p({
// 	transports: [webSockets()],
// 	connectionEncryption: [noise()],
// 	streamMuxers: [yamux()],
// 	datastore: datastore,
// 	peerDiscovery: [
// 		bootstrap({
// 			list: [
// 				"/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
// 				"/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
// 				"/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
// 				"/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
// 			],
// 		}),
// 	],
// 	services: {
// 		identify: identify(),
// 		identifyPush: identifyPush(),
// 		autoNAT: autoNAT(),
// 		dcutr: dcutr(),
// 		dht: kadDHT({
// 			protocol: "/ipfs/kad/1.0.0",
// 			peerInfoMapper: removePrivateAddressesMapper,
// 		}),
// 	},
// });

// await libp2p.start();

const helia = await createHelia({
	datastore,
	blockstore,
});

await helia.libp2p.services.dht.setMode("server");

const textEncoder = new TextEncoder();
const decoder = new TextDecoder();

helia.libp2p.addEventListener("peer:connect", (evt) => {
	log("connected to peer: ", evt.detail);
});

helia.libp2p.addEventListener("peer:disconnect", (evt) => {
	log("disconnected from peer: ", evt.detail);
});

const heliafs = unixfs(helia);

app.get("/", (req, res) => {
	res.json("Hello World!");
});

app.get("/peers", async (req, res) => {
	const peers = await helia.libp2p.getPeers();
	res.json(peers);
});

app.get("/cat/:cid", async (req, res) => {
	const cidString = req.params.cid;
	let text = "";
	const cid = CID.parse(cidString);
	for await (const chunk of heliafs.cat(cid)) {
		text += decoder.decode(chunk, {
			stream: true,
		});
	}
	res.json(text);
});

app.get("/add/:text", async (req, res) => {
	const text = req.params.text;
	const data = textEncoder.encode(text);
	const cid = await heliafs.addBytes(data, helia.blockstore);
	res.json(cid);
});

app.get("/connect/:peerId", async (req, res) => {
	try {
		const peerString = req.params.peerId;
		const peerId = peerIdFromString(peerString);
		const peerInfo = await helia.libp2p.peerRouting.findPeer(peerId);
		res.json(peerInfo);
	} catch (error) {
		res.json(error);
	}
});

app.listen(3000, () => {
	log("Example app listening on: http://localhost:3000");
});
