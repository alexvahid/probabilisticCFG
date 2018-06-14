# probabilisticCFG

## Instructions to run
- Install nodejs and npm
- Install the required packages by running the following in the directory that contains package.js
    - $ npm install
- Make the following modification to the Styx node module:
    - Add the following after line 24 in probabilisticCFG/node_modules/styx/lib/exporters/object.js:
    
    probability: edge.probability
    
- Run webPPLCFG.js:
    - $ node ./webPPLCFG.js
    
    - This will output usage information for being able to produce a probability-labeled CFG for a given input program.
    - Once the analysis is performed, a visualization will be provided in the output PNG specified (default out.png).
    
- Example input programs to run our program on are provided in the tests/ directory.
- Several pre-defined "node scripts" to quickly run our code on some of these input programs are provided in package.json.
    - For example, 
        - "$ npm run ex1" will run "$ node ./webPPLCFG.js ./tests/if_else_conditioning1.wppl -o ex1.png"
        - "$ npm run ex1_cond" will run "node ./webPPLCFG.js ./tests/if_else_conditioning1.wppl -o ex1_cond.png -c 7"
        - etc...
