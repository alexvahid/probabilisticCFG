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
    
