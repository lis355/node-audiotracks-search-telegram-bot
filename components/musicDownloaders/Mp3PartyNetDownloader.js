import { JSDOM } from "jsdom";

import fetch from "../../tools/fetchWithCookies.js";
import MusicDownloader from "./MusicDownloader.js";
import Track from "./Track.js";

const BASE_URL = "https://mp3party.net/";

class Mp3PartyNetTrack extends Track {
	constructor(artist, title, id, url, downloader) {
		super(artist, title);

		this.id = id;
		this.url = url;
		this.downloader = downloader;
	}

	async downloadTrack() {
		return this.downloader.downloadTrack(this);
	}
}

export default class Mp3PartyNetDownloader extends MusicDownloader {
	async searchTracks(queryString) {
		const url = new URL(BASE_URL);
		url.pathname = "search";
		url.searchParams.set("q", queryString);

		const searchResponse = await fetch(url.href, {
			method: "GET"
		});

		const searchResponseText = await searchResponse.text();

		const dom = new JSDOM(searchResponseText);
		const trackElements = Array.from(dom.window.document.querySelectorAll(".track.song-item .track__user-panel"))
			.map(trackElement => {
				return new Mp3PartyNetTrack(
					trackElement.getAttribute("data-js-artist-name"),
					trackElement.getAttribute("data-js-song-title"),
					trackElement.getAttribute("data-js-id"),
					trackElement.getAttribute("data-js-url"),
					this
				);
			});

		return trackElements;
	}

	async downloadTrack(track) {
		const url = new URL(BASE_URL);
		url.pathname = "song_permissions";

		const songPermissionsResponse = await fetch(url.href, {
			method: "POST",
			headers: {
				"content-type": "application/json"
			},
			body: JSON.stringify({
				ids: [
					track.id
				]
			})
		});

		const songPermissionsResponseData = await songPermissionsResponse.json();
		if (!songPermissionsResponseData ||
			!Array.isArray(songPermissionsResponseData) ||
			songPermissionsResponseData.length === 0 ||
			songPermissionsResponseData[0].id !== track.id ||
			!songPermissionsResponseData[0].downloadable) throw new Error(`Track not allowed to download, ${track.artist} - ${track.title}, ID=${track.id}, URL=${track.url}`);

		const trackFileResponse = await fetch(track.url, {
			method: "GET"
		});

		const trackFileBuffer = Buffer.from(await trackFileResponse.arrayBuffer());

		return trackFileBuffer;
	}
}
