import path from "node:path";

import { fetch as fetchWithCookies, CookieJar } from "node-fetch-cookies";
import fs from "fs-extra";

const COOKIES_FILE_PATH = path.resolve("./tmp/cookies.json");
const COOKIES_FILE_DIRECTORY = path.dirname(COOKIES_FILE_PATH);
const cookieJar = new CookieJar(COOKIES_FILE_PATH);

if (!fs.existsSync(COOKIES_FILE_DIRECTORY)) fs.mkdirSync(COOKIES_FILE_DIRECTORY);

try {
	await cookieJar.load();
} catch (_) {
}

export default async function fetch() {
	const result = await fetchWithCookies(cookieJar, ...arguments);

	await cookieJar.save();

	return result;
}