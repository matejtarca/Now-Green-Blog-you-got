const exec = require('./exec_promise');

module.exports = async function getVideoResolutionAndBitrate(path){
    console.log("get video start");
    const output = await exec(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,bit_rate -of default=nw=1:nk=1 ./dist/temp/${path}`);
    const lines = output.split('\n');
    console.log("get video return");
    return [parseInt(lines[0]), parseInt(lines[1]), parseInt(lines[2])];
};