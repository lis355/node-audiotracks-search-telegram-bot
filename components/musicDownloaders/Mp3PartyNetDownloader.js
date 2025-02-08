import { JSDOM } from "jsdom";
import filenamify from "filenamify";

import MusicDownloader from "./MusicDownloader.js";
import Track from "./Track.js";

const BASE_URL = "https://mp3party.net/";

class Mp3PartyNetTrack extends Track {
	constructor(title, url, downloader) {
		super(title);

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
			.map(trackElement => new Mp3PartyNetTrack(`${trackElement.getAttribute("data-js-artist-name")} - ${trackElement.getAttribute("data-js-song-title")}`, trackElement.getAttribute("data-js-url"), this));

		return trackElements;
	}

	async downloadTrack(track) {
		const trackFileResponse = await fetch(track.url);
		const trackFileBuffer = Buffer.from(await trackFileResponse.arrayBuffer());

		return {
			fileName: `${filenamify(track.title)}.mp3`,
			trackFileBuffer
		};
	}
}
