import { Telegraf, Input, session, Scenes } from "telegraf";

import ApplicationComponent from "./app/ApplicationComponent.js";

function authMiddleware(ctx, next) {
	if (!authMiddleware.whitelistUserIds) authMiddleware.whitelistUserIds = String(process.env.TELEGRAM_WHITELIST_USER_IDS).split(",").map(Number).filter(Number.isInteger);
	if (!authMiddleware.adminUserIds) authMiddleware.adminUserIds = String(process.env.TELEGRAM_ADMIN_USER_IDS).split(",").map(Number).filter(Number.isInteger);

	ctx.isAuthenticated = authMiddleware.whitelistUserIds == 0 ||
		authMiddleware.whitelistUserIds.includes(ctx.chat.id);
	ctx.isAdmin = authMiddleware.adminUserIds.includes(ctx.chat.id);

	return next();
}

function isUserInWhiteListMiddleware(ctx, next) {
	if (!ctx.isAuthenticated) throw new Error(`User @${ctx.chat.username} (id=${ctx.chat.id}) is not in whitelist`);

	return next();
}

function isUserAdminMiddleware(ctx, next) {
	if (!ctx.isAdmin) throw new Error(`User @${ctx.chat.username} (id=${ctx.chat.id}) is not admin`);

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
				isUserInWhiteListMiddleware,
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
				.command("stop",
					isUserAdminMiddleware,
					async ctx => {
						this.application.quit(1);
					})
				.on("message", async ctx => {
					console.log(`Search audio for user @${ctx.chat.username} (id=${ctx.chat.id}) query="${ctx.message.text}"`);

					const replyMessageInfo = await this.bot.telegram.sendMessage(ctx.chat.id, "Поиск...");
					ctx.session.messageToDeleteIds.push(replyMessageInfo["message_id"]);

					const tracks = await this.application.musicDownloadManager.searchTracks(ctx.message.text.trim().toLowerCase());
					if (tracks.length === 0) {
						this.autoDeleteContextMessage(ctx);
						await this.sendMessageWithAutoDelete(ctx.chat.id, "Не найдено");
					} else {
						ctx.session.trackInfos = tracks
							.slice(0, MAX_SEARCH_ENTRIES_BUTTONS_COUNT);

						const replyMessageInfo = await this.bot.telegram.sendMessage(
							ctx.chat.id,
							"Найденные треки:",
							InlineKeyboard(
								...ctx.session.trackInfos
									.map((trackInfo, index) => {
										let buttonTitle = `${trackInfo.artist} - ${trackInfo.title}`;
										if (this.application.isDevelopment) buttonTitle += ` | ${trackInfo.constructor.name}`;

										return Row(
											Button(buttonTitle, `track_${index}`)
										);
									}),
								Row(
									Button("-- Back --", "back")
								)
							));

						ctx.session.messageToDeleteIds.push(ctx.message["message_id"], replyMessageInfo["message_id"]);
					}
				})
				.action("back", ctx => ctx.scene.enter("main"))
				.action(/track_\d/, async ctx => {
					try {
						const track = ctx.session.trackInfos[Number(ctx.match.input.split("_")[1])];

						console.log(`Download audio track "${track.title}" for user @${ctx.chat.username} (id=${ctx.chat.id})`);

						const replyMessageInfo = await this.bot.telegram.sendMessage(ctx.chat.id, "Загрузка...");
						ctx.session.messageToDeleteIds.push(replyMessageInfo["message_id"]);

						const trackFileBuffer = await track.downloadTrack();

						console.log(`Convert audio track "${track.title}" for user @${ctx.chat.username} (id=${ctx.chat.id})`);

						const mp3TrackBuffer = await this.application.musicConverter.convertAudioTrackBufferToMp3TrackBuffer(trackFileBuffer, track.artist, track.title);

						console.log(`Uploading audio track "${track.title}" for user @${ctx.chat.username} (id=${ctx.chat.id})`);

						await this.bot.telegram.sendAudio(ctx.chat.id, Input.fromBuffer(mp3TrackBuffer));
					} catch (error) {
						console.error(`Error by user @${ctx.chat.username} (id=${ctx.chat.id})`);
						console.error(error);

						await this.bot.telegram.sendMessage(ctx.chat.id, "Произошла внутренняя ошибка");
					}

					ctx.session.trackInfos = null;

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
