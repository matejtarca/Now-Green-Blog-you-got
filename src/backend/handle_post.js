const createTempFile = require('./util/newfile');
const execPromise = require('./util/exec_promise');
const getVideoResolution = require('./util/get_video_resolution');

const markdown = require('markdown-wasm');

const sharp = require('sharp');

const routeMap = new Map();
routeMap.set('/upload', upload);
routeMap.set('/create-post', createPost);

async function upload(req, res){
	console.log('upload');

	const tempFile = await createTempFile('./dist/temp');

	req.pipe(tempFile.fstream);

	req.on('end', () => {
		res.statusCode = 200;
		res.end(tempFile.name);

		processVideo(tempFile.name, './dist/temp', tempFile.name);
	});

	req.on('error', (error) => {
		res.statusCode = 500;
		res.end(error.message);
	});
}

async function createPost(req, res){
	console.log(req.body);
	res.statusCode = 200;

	//const html = markdown.parse(req.body.content);
	//console.log(html);

	res.end('ok');
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
	const [ width, height, bitrate ] = await getVideoResolution(source);
	
	const commandStart = `ffmpeg -y -hwaccel cuda -i ./dist/temp/${source}`;
	//const commandStart = `ffmpeg -y -i ./dist/temp/${source}`;
	
	let command = commandStart + ` -c:a aac -b:a 96k -map a ${destination}/audio_${filename}.m4a`;
	
	let streams = 0;

	for (const quality of processingQualities){
		if (quality.width > width){
			continue;
		}

		let targetWidth = Math.round(width * quality.height / height);
		if (targetWidth % 2 !== 0){
			targetWidth += 1;
		}

		command += ` -c:a aac -b:a ${quality.audioBitrate} -c:v h264_nvenc -preset p6 -vf "hwupload_cuda,scale_cuda=w=${targetWidth}:h=${quality.height}" -maxrate ${bitrate} -rc constqp -cq ${quality.quality} ${destination}/${quality.name}_${filename}`;
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

async function processImage(sourceBuffer, destination, filename){
	const image = sharp(sourceBuffer);
	const metadata = await image.metadata();
	
	let lossless = false;
	if (metadata.format === 'png'){
		lossless = true;
	} 

	for (const quality of imageQualities){
		if (quality.height > metadata.height){
			continue;
		}

		await sharp(sourceBuffer)
		.resize({ height: quality.height })
		.webp({ lossless: lossless, effort: 6, quality: 85 })
		.toFile(`${destination}/${quality.name}_${filename}.webp`);
	}
}
//const fs = require('fs');
//processImage(fs.readFileSync('./dist/temp/96195951_p0.png'), './dist/temp', '96195951_p0');

module.exports = async function handle_post(req, res){
	const handler = routeMap.get(req.url);
	if (typeof handler !== 'function'){
		res.statusCode = 404;
		return res.end('Not Found');
	}

	handler(req, res);
};
