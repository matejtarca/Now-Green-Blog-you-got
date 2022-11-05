const { exec } = require('child_process');

module.exports = function exec_promise(command){
    return new Promise((resolve, reject) => {
        console.log("EXEC: running command", command);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return reject(error);
            }
            
            if (stderr) {
                console.log(`stderr: ${stderr}`);
            }

            console.log(`stdout: ${stdout}`);

            resolve(stdout);
        });
    });
};
