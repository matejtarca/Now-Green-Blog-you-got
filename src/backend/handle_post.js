const createTempFile = require('./util/newfile');
const execPromise = require('./util/exec_promise');

const markdown = require('markdown-wasm');

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
	});

	req.on('error', (error) => {
		res.statusCode = 500;
		res.end(error.message);
	});
}

async function createPost(req, res){
	console.log(req.body);
	res.statusCode = 200;

	const html = markdown.parse(req.body.content);
	console.log(html);

	res.end('ok');
}

const processingQualities = [
	{
		name: '1440p',
		width: 2560,
		bitrate: '14k'
	},
	{
		name: '1080p',
		height: 1080,
		bitrate: '8000k'
	},
	{
		name: '720p',
		height: 720,
		bitrate: '3500k'
	},
	{
		name: '480p',
		height: 480,
		bitrate: '1400k'
	},
	{
		name: '144p',
		height: 144,
		bitrate: '150k'
	}
];

async function processVideo(source, destination){
	const [ width, height ] = await getVideoResolution(source);
	
	let command = `ffmpeg -y -hwaccel cuda -i IMG_0379.MOV`;

	for (const quality of processingQualities){
		if (quality.width > width){
			continue;
		}

		let targetHeight = Math.round(width * quality.height / height);
		if (targetHeight % 2 !== 0){
			targetHeight += 1;
		}

		command
	}

	const start = '';

	await execPromise('');
}

module.exports = async function handle_post(req, res){
	const handler = routeMap.get(req.url);
	if (typeof handler !== 'function'){
		res.statusCode = 404;
		return res.end('Not Found');
	}

	handler(req, res);
};
