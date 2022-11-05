const exec = require('./exec_promise');

module.exports = async function getVideoResolution(path){
    const output = await exec(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of default=nw=1:nk=1 ${path}`);
    const lines = output.split('\n');
    return [parseInt(lines[0]), parseInt(lines[1])];
};