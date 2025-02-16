import { spawn } from "node:child_process";

import fs from "fs-extra";

import ApplicationComponent from "./app/ApplicationComponent.js";

export default class MusicConverter extends ApplicationComponent {
	async initialize() {
		await super.initialize();

		if (!process.env.FFMPEG_PATH) throw new Error("FFMPEG_PATH is not set");
		if (!fs.existsSync(process.env.FFMPEG_PATH)) throw new Error("Bad FFMPEG_PATH");
	}

	async convertAudioTrackBufferToMp3TrackBuffer(buffer, artist, title) {
		return new Promise((resolve, reject) => {
			const outBuffers = [];

			const ffmpegProcess = spawn(process.env.FFMPEG_PATH, [
				"-y",
				"-i", "pipe:0",
				"-acodec", "libmp3lame",
				"-b:a", "192k", // set output bitrate to 192 kbps
				"-map_metadata", "-1", // erase all input metadata (tags)
				"-metadata", `artist=${artist}`,
				"-metadata", `title=${title}`,
				"-f", "mp3",
				"-"
			]);

			ffmpegProcess.stdin.end(buffer);

			ffmpegProcess.stdout.on("data", chunk => {
				outBuffers.push(chunk);
			});

			ffmpegProcess.stderr.on("data", data => {
				if (this.application.isDevelopment) console.error(`FFmpeg stderr: ${data.toString()}`);
			});

			ffmpegProcess.on("close", code => {
				return code !== 0
					? reject(new Error(`FFmpeg process exited with code ${code}`))
					: resolve(Buffer.concat(outBuffers));
			});
		});
	}
};
