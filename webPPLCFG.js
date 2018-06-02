'use strict';

//const readline = require('readline');
const fs = require('fs');
const Esprima = require('esprima');
const Styx = require('styx');
const digraphe = require('digraphe');
const cytosnap = require('cytosnap');

var snap = cytosnap();


function runWebPPL() {
    const
    { spawnSync } = require( 'child_process' ),
    out = spawnSync( 'webppl', [ './temp.wppl' ] );

    return out.stdout.toString();
}

function inferProbability(edge) {
    let program = "var m = function() {\n";

    edge.code.forEach(function(blockLevel) {
        edge.code.forEach(function(line) {
            program += "\t" + line + ";\n";
        });
    });
    program += "\treturn ";

    let addAnd = false;
    edge.conditions.forEach(function(condition){
        if (addAnd) program += " && ";
        addAnd = true;
        program += condition;
    });

    program += ";\n"
    program += "}\n";
    program += "JSON.stringify(Infer({ model: m }));\n";

    fs.writeFileSync("./temp.wppl", program, function(err) {
        if(err) {
            return console.log(err);
        }
    });

    let trueProb = 0;
    var dist = JSON.parse(runWebPPL());
    if (dist.support[0] == true) {
        trueProb = dist.probs[0];
    } else {
        trueProb = 1 - dist.probs[0];
    }
    return trueProb;
}

fs.readFile('./tests/if_else.wppl', 'utf8', function(err, code) {
    if (err) {
        console.log(err);
        return;
    }

    runWebPPL();

    //create the ast
    let ast = Esprima.parse(code);

    //create the plain control flow graph
    let controlFlowInfo = Styx.parse(ast);

    //load control flow graph into graph structure
    var graph = new digraphe();
    controlFlowInfo.flowGraph.nodes.forEach(function(node) {
        graph.addNode(node.id.toString(), node);
    });
    controlFlowInfo.flowGraph.edges.forEach(function(edge) {
        graph.addEdge(edge.source.id.toString(), edge.target.id.toString());
    });

    //visit the graph
    let blockLevel = 0;
    let reVisit = true;
    while(reVisit) {
        reVisit = false;
        digraphe.Visitor.BFS(graph, '1', function (array_of_nodes, depth) {
            console.log(depth);
            array_of_nodes.forEach(function(node) {  
                let nodeReady = true; 
                let nodeVisited = false;
                let incomingEdges = node.object.incomingEdges.length;
                let outgoingEdges = node.object.outgoingEdges.length;

                //if this is not ready to visit
                node.object.incomingEdges.forEach(function(edge) {
                    if (typeof edge.probability === 'undefined') {
                        reVisit = true;
                        nodeReady = false;
                    }
                    console.log(edge.source.id + " --> " + edge.target.id + ": " + edge.label);
                });

                //if this has been visited before
                node.object.outgoingEdges.forEach(function(edge) {
                    if (!(typeof edge.probability === 'undefined')) {
                        nodeVisited = true;
                    } 
                });

                //skip this iteration if not ready or not visited
                if (!nodeReady || nodeVisited) return;

                let incomingProbability = null;
                let incomingCode = null;
                let incomingConditions = null;

                //calculate the incoming total prob to this node
                if (incomingEdges == 0) {
                    incomingProbability = 1;
                    incomingCode = [];
                    incomingConditions = [];
                } else if (incomingEdges == 1) {
                    let incomingEdge0 = node.object.incomingEdges[0]

                    incomingProbability = incomingEdge0.probability;
                    incomingCode = incomingEdge0.code;
                    incomingConditions = incomingEdge0.conditions;

                } else if (incomingEdges == 2) {
                    blockLevel--;

                    let incomingEdge0 = node.object.incomingEdges[0]
                    let incomingEdge1 = node.object.incomingEdges[1]

                    incomingProbability = incomingEdge0.probability + incomingEdge1.probability;           
                    incomingEdge0.code.pop();
                    incomingCode = incomingEdge0.code;           
                    incomingEdge0.conditions.pop();
                    incomingConditions = incomingEdge0.conditions;

                } else {
                    console.log("error");
                    return;
                }
                
                if (outgoingEdges == 0) {
                    //do nothing
                } else if (outgoingEdges == 1) {
                    let outgoingEdge0 = node.object.outgoingEdges[0];

                    outgoingEdge0.probability = incomingProbability

                    if (typeof incomingCode[blockLevel] === 'undefined') {
                        incomingCode.push([]);
                    }

                    code = outgoingEdge0.label;
                    if (code != '' && outgoingEdge0.data.type == 'VariableDeclarator') {
                        code = "var " + code;
                    }

                    incomingCode[blockLevel].push(code);
                    outgoingEdge0.code = incomingCode;

                    outgoingEdge0.conditions = incomingConditions;

                } else if (outgoingEdges == 2) {
                    blockLevel++;

                    let outgoingEdge0 = node.object.outgoingEdges[0];
                    let outgoingEdge1 = node.object.outgoingEdges[1];

                    outgoingEdge0.code = incomingCode.slice();
                    outgoingEdge1.code = incomingCode.slice();

                    outgoingEdge0.conditions = incomingConditions.slice();
                    outgoingEdge0.conditions.push(outgoingEdge0.label);

                    outgoingEdge1.conditions = incomingConditions.slice();
                    outgoingEdge1.conditions.push(outgoingEdge1.label);

                    outgoingEdge0.probability = inferProbability(outgoingEdge0);
                    outgoingEdge1.probability = inferProbability(outgoingEdge1);

                } else {
                    console.log("error");
                    return;
                }

            });
        });
    }
    
    let controlFlowJSON = Styx.exportAsJson(controlFlowInfo);

    console.log(controlFlowJSON);

    var elements = {nodes: [], edges: []};
    controlFlowInfo.flowGraph.nodes.forEach(function(node) {
        elements.nodes.push({data: { id: node.id.toString() }})
    });
    controlFlowInfo.flowGraph.edges.forEach(function(edge) {
        elements.edges.push({data: { source: edge.source.id.toString(), target: edge.target.id.toString(), name: edge.label + ", " + edge.probability }});
    });

    snap.start().then(function(){
        return snap.shot({    
            elements: elements,
            layout: { // http://js.cytoscape.org/#init-opts/layout
                name: 'breadthfirst',
                maximalAdjustments: 100,
            },
            style: [
                {
                selector: 'node',
                style: {
                    'content': 'data(id)',
                    'text-valign': 'center',
                    'text-halign': 'middle',
                    'background-color': '#11479e',
                    'color' : 'white',
                }
                },
            
                {
                selector: 'edge',
                style: {
                    'content': 'data(name)',
                    'text-opacity': 0.5,
                    'text-valign': 'bottom',
                    'text-halign': 'right',
                    'curve-style': 'bezier',
                    'width': 4,
                    'target-arrow-shape': 'triangle',
                    'line-color': '#9dbaea',
                    'target-arrow-color': '#9dbaea'
                }
                }
            ],
            
            resolvesTo: 'base64uri',
            format: 'png',
            width: 640,
            height: 480,
            background: 'white'
        });
    }).then(function( img ){
        var base64Data = img.replace(/^data:image\/png;base64,/, "");
        fs.writeFile("out.png", base64Data, 'base64', function(err) {
            if(err) {
                return console.log(err);
            }
            process.exit()
        });
    });
});



