import { JSDOM } from "jsdom";

import MusicDownloader from "./MusicDownloader.js";
import Track from "./Track.js";

const BASE_URL = "https://muzofond.fm/";

class MuzofondFMTrack extends Track {
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

export default class MuzofondFMDownloader extends MusicDownloader {
	async searchTracks(queryString) {
		const url = new URL(BASE_URL);
		url.pathname = `search/${encodeURIComponent(queryString)}`;

		const searchResponse = await fetch(url.href, {
			method: "GET"
		});

		const searchResponseText = await searchResponse.text();

		const dom = new JSDOM(searchResponseText);
		const trackElements = Array.from(dom.window.document.querySelectorAll(".mainSongs.songs .item"))
			.map(trackElement => {
				const descriptionElements = Array.from(trackElement.querySelectorAll(".desc h3 a"));
				const playElement = trackElement.querySelector(".actions .play");

				return new MuzofondFMTrack(
					descriptionElements[0].text.trim(),
					descriptionElements[1].text.trim(),
					playElement.getAttribute("data-id"),
					playElement.getAttribute("data-url"),
					this
				);
			});

		return trackElements;
	}

	async downloadTrack(track) {
		const trackFileResponse = await fetch(track.url, {
			method: "GET"
		});

		const trackFileBuffer = Buffer.from(await trackFileResponse.arrayBuffer());

		return trackFileBuffer;
	}
}
