# probabilisticCFG

## installing Node
- brew install node
- simple node example --> node helloNode.js

## installing webPPL
- npm install -g webppl
- simple webppl example --> webppl testWebPPL.wppl

## ast
- webPPL ast defined in webppl/src/transforms/cps.js
- generate listener --> java -cp antlr-4.7.1-complete.jar org.antlr.v4.Tool -visitor -Dlanguage=JavaScript ECMAScript.g4

## modifications to node modules
- Add the following after line 24 in probabilisticCFG/node_modules/styx/lib/exporters/object.js
    - probability: edge.probability

## TODO
- Remove unreachable nodes
- Analysis which forces control through a specific node
