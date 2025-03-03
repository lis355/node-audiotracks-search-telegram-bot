import ApplicationComponent from "../app/ApplicationComponent.js";
import DriveMusicClubDownloader from "./DriveMusicClubDownloader.js";
import Mp3PartyNetDownloader from "./Mp3PartyNetDownloader.js";

const MAX_SEARCH_ENTRIES_AMOUNT = 10;

function getRandomArrayIndex(arr) {
	return Math.floor(Math.random() * arr.length);
}

function shuffleArray(arr) {
	for (let i = 0; i < arr.length; i++) {
		const a1 = getRandomArrayIndex(arr);
		const a2 = getRandomArrayIndex(arr);

		if (a1 === a2) continue;

		const tmp = arr[a1];
		arr[a1] = arr[a2];
		arr[a2] = tmp;
	}
}

export default class MusicDownloadManager extends ApplicationComponent {
	async initialize() {
		this.musicDownloaders = this.createMusicDownloaders();
	}

	createMusicDownloaders() {
		return [
			new DriveMusicClubDownloader(this),
			new Mp3PartyNetDownloader(this)
		];
	}

	async searchTracks(queryString) {
		shuffleArray(this.musicDownloaders);

		const result = [];

		for (const musicDownloader of this.musicDownloaders) {
			const tracks = await musicDownloader.searchTracks(queryString);

			result.push(...tracks);

			if (result.length >= MAX_SEARCH_ENTRIES_AMOUNT) break;
		}

		result.splice(MAX_SEARCH_ENTRIES_AMOUNT, result.length - MAX_SEARCH_ENTRIES_AMOUNT);

		return result;
	}
}
