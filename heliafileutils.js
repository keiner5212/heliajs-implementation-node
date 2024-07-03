import { CID } from "multiformats/cid";
import debug from "debug";

const log = debug("helia-utils");

async function provideCid(cid, helia) {
	log("providing cid: " + cid.toString());
	const start = Date.now();
	for await (const event of helia.libp2p.services.dht.provide(cid)) {
		log("Providing...");
	}
	const end = Date.now();
	log("cid provided, time: " + (end - start) + "ms");
}

async function getUint8ArrayFromFile(file) {
	try {
		const data = await file.arrayBuffer();
		return new Uint8Array(data);
	} catch (error) {
		throw error;
	}
}

function fromUint8ArrayToFile(uint8Array, fileName, fileType) {
	const blob = new Blob([uint8Array], { type: fileType });
	return new File([blob], fileName, { type: fileType });
}

export async function commitFile(file, helia, fs, error, starting) {
	if (!error && !starting) {
		try {
			const buffer = await getUint8ArrayFromFile(file);
			const cid = await fs.addBytes(buffer);
			await provideCid(cid, helia);
			return cid.toString();
		} catch (e) {
			console.error(e);
		}
	} else {
		log("please wait for helia to start");
	}
}

export async function fetchCommittedFile(
	cidString,
	fileName,
	fileType,
	fs,
	error,
	starting
) {
	if (!error && !starting) {
		try {
			let chunks = [];
			const cid = CID.parse(cidString);
			let parte = 0;
			for await (const chunk of fs.cat(cid)) {
				log("Loading part:", ++parte);
				chunks.push(chunk);
			}
			let totalLength = chunks.reduce(
				(acc, value) => acc + value.length,
				0
			);
			let combined = new Uint8Array(totalLength);
			let offset = 0;
			chunks.forEach((chunk) => {
				combined.set(chunk, offset);
				offset += chunk.length;
			});

			return fromUint8ArrayToFile(combined, fileName, fileType);
		} catch (e) {
			console.error(e);
		}
	} else {
		log("please wait for helia to start");
	}
}
