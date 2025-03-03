export default class Track {
	constructor(artist, title) {
		this.artist = artist;
		this.title = title;
	}

	get trackSource() { return `[${this.constructor.name.replace("Track", "")}]`; }

	// trackFileBuffer
	async downloadTrack() { }
}
