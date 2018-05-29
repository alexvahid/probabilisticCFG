//const readline = require('readline');
const fs = require('fs');
const Esprima = require('esprima');
const Styx = require('styx');

/*
let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let code = "";
rl.on('line', function(line) {
    code.concat(line);
});
*/

fs.readFile('input.txt', 'utf8', function(err, code) {
    if (err) {
        console.log(err);
        return;
    }

    let ast = Esprima.parse(code);
    let controlFlowInfo = Styx.parse(ast);
    let controlFlowJSON = Styx.exportAsJson(controlFlowInfo);

    console.log(controlFlowJSON);
});
