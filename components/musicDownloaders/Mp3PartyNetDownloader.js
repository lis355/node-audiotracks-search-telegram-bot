import { JSDOM } from "jsdom";

import MusicDownloader from "./MusicDownloader.js";
import Track from "./Track.js";

const BASE_URL = "https://mp3party.net/";

class Mp3PartyNetTrack extends Track {
	constructor(artist, title, url, downloader) {
		super(artist, title);

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
			method: "GET",
			headers: {
				priority: "i",
				range: "bytes=0-"
			}
		});

		const searchResponseText = await searchResponse.text();

		const dom = new JSDOM(searchResponseText);
		const trackElements = Array.from(dom.window.document.querySelectorAll(".track.song-item .track__user-panel"))
			.map(trackElement => {
				return new Mp3PartyNetTrack(
					trackElement.getAttribute("data-js-artist-name"),
					trackElement.getAttribute("data-js-song-title"),
					trackElement.getAttribute("data-js-url"),
					this);
			});

		return trackElements;
	}

	async downloadTrack(track) {
		const trackFileResponse = await fetch(track.url);
		const trackFileBuffer = Buffer.from(await trackFileResponse.arrayBuffer());

		return trackFileBuffer;
	}
}
