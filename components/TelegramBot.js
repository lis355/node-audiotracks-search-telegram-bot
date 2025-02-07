import { Telegraf, Input, session, Scenes } from "telegraf";

import ApplicationComponent from "./app/ApplicationComponent.js";

function authMiddleware(ctx, next) {
	return isMeMiddleware(ctx, next);
}

function isMeMiddleware(ctx, next) {
	if (ctx.chat.id !== Number(process.env.TELEGRAM_USER_ID)) throw new Error(`Bad user @${ctx.chat.username} (id=${ctx.chat.id})`);

	return next();
}

function copyableText(str) {
	return `\`${str}\``;
}

const MAX_SEARCH_ENTRIES_BUTTONS_COUNT = 10;
const MESSAGE_LIFETIME_IN_MILLISECONDS = 10000;

export default class TelegramBot extends ApplicationComponent {
	async initialize() {
		await super.initialize();

		this.initializeBot();

		console.log("[TelegramBot]: started");
	}

	initializeBot() {
		this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

		this.bot
			.use(
				(ctx, next) => {
					// if (this.application.isDevelopment) console.log(_.omit(ctx, "telegram"));

					return next();
				},
				authMiddleware,
				session({
					defaultSession: () => ({})
				}),
				(ctx, next) => {
					ctx.session.messageToDeleteIds = ctx.session.messageToDeleteIds || [];

					return next();
				},
				this.createStage().middleware()
			)
			.catch((error, ctx) => {
				console.error(`Error for ${ctx.updateType}, ${error.message}, ${error.stack}`);
			})
			.launch({ dropPendingUpdates: !this.application.isDevelopment });
	}

	createStage() {
		function Row(...children) {
			return children;
		}

		function Button(caption, action) {
			return { text: caption, callback_data: action };
		}

		function InlineKeyboard(...children) {
			return {
				reply_markup: {
					inline_keyboard: children
				}
			};
		}

		const stage = new Scenes.Stage([
			new Scenes.BaseScene("main")
				.enter(async ctx => {
					await this.deleteSessionMessages(ctx);
				})
				.command("start", async ctx => {
					await this.bot.telegram.sendMessage(ctx.chat.id, this.getHelpString(), { parse_mode: "Markdown" });

					ctx.scene.enter("main");
				})
				.command("help", async ctx => {
					await this.bot.telegram.sendMessage(ctx.chat.id, this.getHelpString(), { parse_mode: "Markdown" });

					ctx.scene.enter("main");
				})
				.command("stop", async ctx => {
					this.application.quit(1);
				})
				.on("message", async ctx => {
					const trackInfos = await this.application.musicDownloader.searchTracks(ctx.message.text.trim().toLowerCase());
					if (trackInfos.length === 0) {
						this.autoDeleteContextMessage(ctx);
						await this.sendMessageWithAutoDelete(ctx.chat.id, "Не найдено");
					} else {
						this.trackInfos = trackInfos
							.slice(0, MAX_SEARCH_ENTRIES_BUTTONS_COUNT);

						const replyMessageInfo = await this.bot.telegram.sendMessage(
							ctx.chat.id,
							"Найденные треки:",
							InlineKeyboard(
								...this.trackInfos
									.map((trackInfo, index) =>
										Row(
											Button(trackInfo.title, `track_${index}`)
										)
									),
								Row(
									Button("-- Back --", "back")
								)
							));

						ctx.session.messageToDeleteIds.push(ctx.message["message_id"], replyMessageInfo["message_id"]);
					}
				})
				.action("back", ctx => ctx.scene.enter("main"))
				.action(/track_\d/, async ctx => {
					const { fileName, trackFileBuffer } = await this.application.musicDownloader.downloadTrack(this.trackInfos[Number(ctx.match.input.split("_")[1])]);

					const replyMessageInfo = await this.bot.telegram.sendMessage(ctx.chat.id, "Загрузка...");
					ctx.session.messageToDeleteIds.push(replyMessageInfo["message_id"]);

					await this.bot.telegram.sendAudio(ctx.chat.id, Input.fromBuffer(trackFileBuffer, fileName));

					this.trackInfos = null;

					ctx.scene.enter("main");
				})
		], {
			default: "main"
		});

		return stage;
	}

	getHelpString() {
		return `${this.application.name} v${this.application.version}

${copyableText("/start")} - start bot
${copyableText("/stop")} - stop bot`;
	}

	async deleteSessionMessages(ctx) {
		if (ctx.session.messageToDeleteIds.length > 0) {
			for (const messageId of ctx.session.messageToDeleteIds) {
				try {
					await this.bot.telegram.deleteMessage(ctx.chat.id, messageId);
				} catch (error) {
				}
			}

			ctx.session.messageToDeleteIds = [];
		}
	}

	async sendMessageWithAutoDelete(chatId, message, options) {
		const sendMessageResponse = await this.bot.telegram.sendMessage(chatId, message, options);

		await this.autoDeleteChatMessage(chatId, sendMessageResponse["message_id"]);
	}

	autoDeleteChatMessage(chatId, messageId) {
		setTimeout(async () => {
			await this.bot.telegram.deleteMessage(chatId, messageId);
		}, MESSAGE_LIFETIME_IN_MILLISECONDS);
	}

	autoDeleteContextMessage(ctx) {
		this.autoDeleteChatMessage(ctx.message.chat.id, ctx.message["message_id"]);
	}

	async processTextMessage(ctx) {
		await this.processSearchCommand(ctx);
	}

	async sendMessage(chatId, message) {
		const replyMessageInfo = await this.bot.telegram.sendMessage(chatId, message);

		const deleteMessage = async () => this.deleteMessage(chatId, replyMessageInfo["message_id"]);

		return deleteMessage;
	}

	async sendMessageWithAutodelete(chatId, message) {
		const deleteMessage = await this.sendMessage(chatId, message);

		setTimeout(deleteMessage, MESSAGE_LIFETIME_IN_MILLISECONDS);
	}

	async deleteMessage(chatId, messageId) {
		await this.bot.telegram.deleteMessage(chatId, messageId);
	}
};
