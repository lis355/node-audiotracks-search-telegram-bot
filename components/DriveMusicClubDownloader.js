import { JSDOM } from "jsdom";
import filenamify from "filenamify";

import ApplicationComponent from "./app/ApplicationComponent.js";

const BASE_URL = "https://www.drivemusic.club/";

class TrackInfo {
	constructor(title, url) {
		this.title = title;
		this.url = url;
	}
}

export default class DriveMusicClubDownloader extends ApplicationComponent {
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
			.map(searchResponseItem => new TrackInfo(searchResponseItem.value, searchResponseItem.label));
	}

	async downloadTrack(trackInfo) {
		const url = new URL(BASE_URL);
		url.pathname = trackInfo.url;

		const trackPageResponse = await fetch(url.href, {
			method: "GET"
		});

		const trackPageResponseText = await trackPageResponse.text();

		const dom = new JSDOM(trackPageResponseText);
		const trackTitle = dom.window.document.querySelector(".song-title-text").textContent;
		const fileName = filenamify(`${trackTitle}.mp3`);
		const trackLink = dom.window.document.querySelector("a.song-author-btn.btn-download").getAttribute("href");

		const trackFileResponse = await fetch(trackLink);
		const trackFileBuffer = Buffer.from(await trackFileResponse.arrayBuffer());

		return {
			fileName,
			trackFileBuffer
		};
	}
}
