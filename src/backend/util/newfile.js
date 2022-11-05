const fs = require("fs");
const pathlib = require("path").posix;

module.exports = async function createFile(path){
	let tempFile;
	while (true){
		try {
			tempFile = await tryCreateFile(path);
			break;
		} catch (error){
			console.log("tempfile creation failed lol");
			console.log(error);
		}
	}
	return tempFile;
}

function tryCreateFile(path){
	return new Promise((resolve, reject) => {
		const filename = randomString(48);
		const tempFilePath = pathlib.join(path, filename);
		const fstream = fs.createWriteStream(tempFilePath, {flags: "wx", highWaterMark: 2 * 1024 * 1024})
		.on("error", (error) => {
			reject(error);
		})
		.on("open", () => {
			resolve({
				path: tempFilePath,
				name: filename,
				fstream: fstream
			});
		});
	});
}

function randomString(length){
	const charSet = "0123456789abcdefghijklmnopqrstuvwxyz";
	const charCount = charSet.length - 1;
	let string = "";
	for (let i = 0; i < length; i++){
		string += charSet.charAt(Math.floor(Math.random() * charCount));
	}
	return string;
}