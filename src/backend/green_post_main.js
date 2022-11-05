const http = require('http');
const handlePost = require('./handle_post');
const handleGet = require('./handle_get');

async function getBodyString(req, size){
	const body = await getBodyBuffer(req, size);
	return body.toString('utf8');
}

function getBodyBuffer(req, size){
	return new Promise((resolve) => {
		let body = Buffer.alloc(size);
		let pos = 0;

		req.on('data', function(chunk) {
			chunk.copy(body, pos);
			pos += chunk.length;
		});

		req.on('end', function() {
			resolve(body);
		});
	});
}

function getContentLength(req){
	const contentLength = req.headers['content-length'];
	if(contentLength === undefined){
		throw new Error('Content-Length header is missing');
	}

	const size = parseInt(contentLength);
	if (Number.isNaN(size)){
		throw new Error('Content-Length header is not a number');
	}

	return size;
}

function isJSON(req){
	const contentType = req.headers['content-type'];
	return contentType === 'application/json';
}

const server = http.createServer(async (req, res) => {
	if (req.method === 'POST'){
		const requestsJSON = isJSON(req);

		try {
			const size = getContentLength(req);

			if (requestsJSON){
				const body = await getBodyString(req, size);
				req.body = JSON.parse(body);
			}
		} catch (error){
			res.statusCode = 400;
			return res.end(error.message);
		}

		handlePost(req, res);
	} else if (req.method === "OPTIONS") {
		res.statusCode = 200;
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");
		res.end();
	} else if (req.method === "GET") {
		handleGet(req, res);
	}
});

server.listen(3000, '0.0.0.0');
