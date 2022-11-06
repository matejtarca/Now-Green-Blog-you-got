const createTempFile = require('./util/newfile');
const execPromise = require('./util/exec_promise');
const crypto = require('crypto');
const getVideoInfo = require('./util/get_video_info');

const db = require('better-sqlite3')('src/backend/db/db');

const fs = require('fs');
const sharp = require('sharp');
const fileTypeCjs = require('file-type-cjs');

const routeMap = new Map();
routeMap.set('/upload', upload);
routeMap.set('/submit-post', createPost);

async function upload(req, res){
	console.log('upload');

	const tempFile = await createTempFile('./dist/temp');

	req.pipe(tempFile.fstream);

	req.on('end', () => {
		res.statusCode = 200;
		res.end(tempFile.name);

		//processVideo(tempFile.name, './dist/temp', tempFile.name);
	});

	req.on('error', (error) => {
		res.statusCode = 500;
		res.end(error.message);
	});
}

async function createPost(req, res){
	if (!req.body.user || !req.body.title || !req.body.content) {
		res.statusCode = 400;
		return res.end('Bad Request');
	}

	try {
		const newPost = db.prepare('INSERT INTO posts (id, user, title, content, ready) VALUES (?, ?, ?, ?, ?)');
		const newMedia = db.prepare('INSERT INTO medias (id, post_id, tmp_slug, filename, code) VALUES (?, ?, ?, ?, ?)');
		const post_id = crypto.randomUUID();
		const insertMedias = db.transaction((medias) => {
			for (const media of medias) {
				const media_id = crypto.randomUUID();
				media.id = media_id;
				newMedia.run(media_id, post_id, media.slug, media.filename, media.code);
			}
		});

		const query = db.transaction((medias) => {
			newPost.run(post_id, req.body.user, req.body.title, req.body.content, 0);
			insertMedias(medias); // nested transaction
		});

		const files = req.body.files;

		for (const file of files){
			file.slug = file.slug.replace("/", "");

			file.filename = file.filename.replace("/", "");
		}

		query(files);

		res.statusCode = 200;
		res.end(post_id);

		// continue with media processing

		let videos = [];
		let promises = [];

		const mediaDestination = `./dist/media/${req.body.user.replace("/", "")}/${post_id}`;

		await fs.promises.mkdir(mediaDestination, { recursive: true });

		for (const media of files){
			const stream = fs.createReadStream(`./dist/temp/${media.slug}`);
			const fileType = await fileTypeCjs.fromStream(stream);
			console.log(fileType);

			if (fileType.mime.startsWith('video/')){
				media.filename = media.filename.slice(0, media.filename.lastIndexOf('.')) + ".mp4";
				videos.push(media);
			} else if (fileType.mime.startsWith('image/')){
				promises.push(processImage(`./dist/temp/${media.slug}`, mediaDestination, media.filename).then((height) => {
					db.prepare('UPDATE medias SET original_height = ? WHERE id = ?').run(height, media.id);
				}));
			}
		}

		async function processVideos(videos){
			for (const video of videos){
				await processVideo(video.slug, mediaDestination, video.filename);
			}
		}

		promises.push(processVideos(videos));

		await Promise.all(promises);

		db.prepare('UPDATE posts SET ready = 1 WHERE id = ?').run(post_id);
	} catch (e) {
		res.statusCode = 500;
		return res.end(e.message);
	}
}

const processingQualities = [
	/*{
		name: '1440p',
		height: 2560,
		quality: '16',
		bitrate: '14k'
	},*/
	{
		name: '1080p',
		height: 1080,
		quality: '16',
		bitrate: '8000k',
		audioBitrate: '96k'
	},
	{
		name: '720p',
		height: 720,
		quality: '16',
		bitrate: '3500k',
		audioBitrate: '96k'
	},
	{
		name: '480p',
		height: 480,
		quality: '16',
		bitrate: '1400k',
		audioBitrate: '64k'
	},
	{
		name: '144p',
		height: 144,
		quality: '16',
		bitrate: '150k',
		audioBitrate: '48k'
	}
];

const MAX_PARALLEL_OUTPUT_STREAMS = 3;

async function processVideo(source, destination, filename){
	const [ width, height, bitrate, hasAudio ] = await getVideoInfo(source);

	const commandStart = `ffmpeg -y -hwaccel cuda -i "./dist/temp/${source}"`;
	//const commandStart = `ffmpeg -y -i ./dist/temp/${source}`;

	let command = commandStart;
	if (hasAudio){
		command += ` -c:a aac -b:a 96k -map a "${destination}/audio_${filename}.m4a"`;
	}

	let streams = 0;

	for (const quality of processingQualities){
		if (quality.width > width){
			continue;
		}

		let targetWidth = Math.round(width * quality.height / height);
		if (targetWidth % 2 !== 0){
			targetWidth += 1;
		}

		command += ` -c:a aac -b:a ${quality.audioBitrate} -c:v h264_nvenc -preset p6 -vf "hwupload_cuda,scale_cuda=w=${targetWidth}:h=${quality.height}" -maxrate ${bitrate} -rc constqp -cq ${quality.quality} "${destination}/${quality.name}_${filename}"`;
		//command += ` -c:a copy -preset medium -vf scale=${targetWidth}:${quality.height} -crf ${quality.quality} ${destination}/${quality.name}_${filename}`;

		console.log(command);
		console.log(quality);

		streams++;
		if (streams === MAX_PARALLEL_OUTPUT_STREAMS){
			await execPromise(command);
			console.log('command exec end');
			streams = 0;
			command = commandStart;
		}
	}

	if (streams !== 0){
		await execPromise(command);
		console.log('command exec end');
	}
}
//processVideo('VID_20221104_132657.mp4', './dist/temp', 'VID_20221104_132657.mp4');


const imageQualities = [
	{
		name: '1080p',
		height: 1080
	},
	{
		name: '720p',
		height: 720
	},
	{
		name: '480p',
		height: 480
	},
	{
		name: '240p',
		height: 240
	},
	{
		name: '144p',
		height: 144
	}
]

async function processImage(sourceBufferOrPath, destination, filename){
	const image = sharp(sourceBufferOrPath);
	const metadata = await image.metadata();

	let lossless = false;
	if (metadata.format === 'png'){
		lossless = true;
	}

	for (const quality of imageQualities){
		if (quality.height > metadata.height){
			continue;
		}

		await image
		.resize({ height: quality.height })
		.webp({ lossless: lossless, effort: 6 })
		.toFile(`${destination}/${quality.name}_${filename}.webp`);
	}

	return metadata.height;
}

module.exports = async function handle_post(req, res){
	const handler = routeMap.get(req.url);
	if (typeof handler !== 'function'){
		res.statusCode = 404;
		return res.end('Not Found');
	}

	handler(req, res);
};
