import path from "node:path";

import fs from "fs-extra";

import TelegramBot from "../TelegramBot.js";
import MusicConverter from "../MusicConverter.js";
import MusicDownloadManager from "../musicDownloaders/MusicDownloadManager.js";

const { name, version } = fs.readJsonSync(path.resolve(process.cwd(), "package.json"));

export default class Application {
	constructor() {
		this.name = name;
		this.version = version;

		process.on("uncaughtException", error => { this.onUncaughtException(error); });
		process.on("unhandledRejection", error => { this.onUnhandledRejection(error); });

		const defaultErrorHandler = error => {
			console.error(error);
		};

		this.onUncaughtException = defaultErrorHandler;
		this.onUnhandledRejection = defaultErrorHandler;

		this.components = [];

		this.addComponent(this.musicDownloadManager = new MusicDownloadManager());
		this.addComponent(this.musicConverter = new MusicConverter());
		this.addComponent(this.telegramBot = new TelegramBot());
	}

	get isDevelopment() {
		return process.env.DEVELOPER_ENVIRONMENT === "true";
	}

	addComponent(component) {
		component.application = this;

		this.components.push(component);
	}

	async initialize() {
		console.log(`[Application]: ${this.name} ${this.version}`);
		if (this.isDevelopment) console.log("[Application]: isDevelopment");

		for (let i = 0; i < this.components.length; i++) await this.components[i].initialize();

		console.log(`[Application]: initialized`);
	}

	async run() {
		for (let i = 0; i < this.components.length; i++) await this.components[i].run();
	}

	async quit(code = 0) {
		for (let i = 0; i < this.components.length; i++) {
			await this.components[i].exit(code);
		}

		this.exit(code);
	}

	exit(code = 0) {
		process.exit(code);
	}
}
