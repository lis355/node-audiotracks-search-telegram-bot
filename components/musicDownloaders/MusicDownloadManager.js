import ApplicationComponent from "../app/ApplicationComponent.js";
import DriveMusicClubDownloader from "./DriveMusicClubDownloader.js";
import Mp3PartyNetDownloader from "./Mp3PartyNetDownloader.js";
import MuzofondFMDownloader from "./MuzofondFMDownloader.js";

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
		this.createMusicDownloaders();
	}

	createMusicDownloaders() {
		if (!process.env.MUSIC_DOWNLOADERS) throw new Error("MUSIC_DOWNLOADERS is not set");
		const musicDownloaderNames = process.env.MUSIC_DOWNLOADERS.split(",").map(s => s.trim()).filter(Boolean);

		const musicDownloaderClasses = [
			DriveMusicClubDownloader,
			Mp3PartyNetDownloader,
			MuzofondFMDownloader
		];

		this.musicDownloaders = musicDownloaderClasses
			.filter(musicDownloaderClass => Boolean(musicDownloaderNames.find(musicDownloaderName => musicDownloaderClass.name.includes(musicDownloaderName))))
			.map(musicDownloaderClass => new musicDownloaderClass(this));

		console.log(`[MusicDownloadManager]: created ${this.musicDownloaders.length} music downloaders; ${this.musicDownloaders.map(musicDownloader => musicDownloader.constructor.name.replace("Downloader", "")).join(", ")}`);
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
