const exec = require('./exec_promise');

module.exports = async function getVideoInfo(path){
    console.log("get video start");
    const output = await exec(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,bit_rate -of default=nw=1:nk=1 ./dist/temp/${path}`);
    const lines = output.split('\n');
    console.log("get video return");

    const audioDetection = await exec(`ffprobe -v error -select_streams a -show_entries stream=codec_type -of default=nw=1:nk=1 ./dist/temp/${path}`);
    const hasAudio = audioDetection.includes('audio');

    return [parseInt(lines[0]), parseInt(lines[1]), parseInt(lines[2]), hasAudio];
};