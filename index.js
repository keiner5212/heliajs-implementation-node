import express from "express";
import { FsBlockstore } from "blockstore-fs";
import { MemoryDatastore } from "datastore-core";

import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";
import morgan from "morgan";

import { commitFile, fetchCommittedFile } from "./heliafileutils.js";

import debug from "debug";
const log = debug("heliajs-implementation-node");
debug.enable("libp2p:transports, libp2p, express, heliajs-implementation-node, helia-utils");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
morgan.token("peers", () => `${peers}`);
app.use(
	morgan(
		":method :url :status :res[content-length] bytes - :response-time ms :peers peers"
	)
);

let peers = 0;
let Helia = null;
let HeliaFs = null;

let error = false;
let starting = true;

try {
	const blockstore = new FsBlockstore("./ipfs/blockstore-hello-app");
	const datastore = new MemoryDatastore();

	Helia = await createHelia({
		datastore,
		blockstore,
	});

	if (!Helia) {
		throw new Error("Helia not created");
	}

	await Helia.libp2p.services.dht.setMode("server");

	Helia.libp2p.addEventListener("peer:connect", (evt) => {
		peers++;
	});

	Helia.libp2p.addEventListener("peer:disconnect", (evt) => {
		peers--;
	});

	HeliaFs = unixfs(Helia);

	log("Helia started");
	starting = false;
} catch (e) {
	log(e);
	error = true;
}

app.get("/", (req, res) => {
	res.json("Hello World!");
});

app.get("/peers", async (req, res) => {
	const peers = await Helia.libp2p.getPeers();
	res.json(peers);
});

app.get("/cat/:cid", async (req, res) => {
	log("cat: " + req.params.cid);
	const cidString = req.params.cid;
	const { filename, fileType } = req.body;

	const file = await fetchCommittedFile(
		cidString,
		filename,
		fileType,
		HeliaFs,
		error,
		starting
	);

	if (file) {
		// fs.writeFileSync("./savedFiles/" + filename, await file.text());

		res.json({
			file,
		});
	} else {
		res.status(404).json({ error: "file not found" });
	}
});

app.get("/add", async (req, res) => {
	const { file } = req.body;
	const cid = await commitFile(file, Helia, HeliaFs, error, starting);
	res.json({ cid });
});

app.get("/add/text", async (req, res) => {
	const { text } = req.body;

	const buffer = new TextEncoder().encode(text);
	const blob = new Blob([buffer], { type: "text/plain" });
	const file = new File([blob], Math.random() * 123452344 + ".txt", {
		type: "text/plain",
	});

	const cid = await commitFile(file, Helia, HeliaFs, error, starting);
	res.json({ cid });
});

app.listen(3000, () => {
	log("Example app listening on: http://localhost:3000");
});
