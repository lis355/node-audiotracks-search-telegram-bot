import ApplicationComponent from "../app/ApplicationComponent.js";
import DriveMusicClubDownloader from "./DriveMusicClubDownloader.js";
import Mp3PartyNetDownloader from "./Mp3PartyNetDownloader.js";

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
		// TODO подумать, как сделать, если у первого даунлоадера будут результаты, но среди них не будет нужного
		for (const musicDownloader of this.musicDownloaders) {
			const tracks = await musicDownloader.searchTracks(queryString);

			if (tracks.length > 0) return tracks;
		}

		return [];
	}
}
