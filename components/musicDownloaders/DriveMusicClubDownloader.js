import { JSDOM } from "jsdom";

import MusicDownloader from "./MusicDownloader.js";
import Track from "./Track.js";

const BASE_URL = "https://www.drivemusic.club/";

class DriveMusicClubTrack extends Track {
	constructor(artist, title, url, downloader) {
		super(artist, title);

		this.url = url;
		this.downloader = downloader;
	}

	async downloadTrack() {
		return this.downloader.downloadTrack(this);
	}
}

export default class DriveMusicClubDownloader extends MusicDownloader {
	async searchTracks(queryString) {
		const url = new URL(BASE_URL);
		url.searchParams.set("do", "search");
		url.searchParams.set("op", "ajax_search");
		url.searchParams.set("q", queryString);
		url.searchParams.set("_", new Date().getMilliseconds());

		const searchResponse = await fetch(url.href, {
			method: "GET"
		});

		const searchResponseText = await searchResponse.text();

		// eslint-disable-next-line no-eval
		const searchResponseJson = eval(searchResponseText);

		return searchResponseJson
			.filter(searchResponseItem => searchResponseItem.type === "song")
			.map(searchResponseItem => {
				const [artist, title] = searchResponseItem.value.split(" - ");

				return new DriveMusicClubTrack(
					artist,
					title,
					searchResponseItem.label,
					this
				);
			});
	}

	async downloadTrack(track) {
		const url = new URL(BASE_URL);
		url.pathname = track.url;

		const trackPageResponse = await fetch(url.href, {
			method: "GET"
		});

		const trackPageResponseText = await trackPageResponse.text();

		const dom = new JSDOM(trackPageResponseText);
		const trackLink = dom.window.document.querySelector("a.song-author-btn.btn-download").getAttribute("href");

		const trackFileResponse = await fetch(trackLink);
		const trackFileBuffer = Buffer.from(await trackFileResponse.arrayBuffer());

		return trackFileBuffer;
	}
}
