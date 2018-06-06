'use strict';

/*
NOTE: All vars must have unique names no matter scope. No variable shadowing. 
*/

const fs = require('fs');
const Esprima = require('esprima');
const Escodegen = require('escodegen')
const Styx = require('styx');
const digraphe = require('digraphe');
const cytosnap = require('cytosnap');
const parseArgs = require('minimist');
const CFGAnalyzer = require('./CFGAnalyzer');
var AstPreprocessing = require("./node_modules/styx/lib/parser/preprocessing/functionExpressionRewriter");
var snap = cytosnap();
var walk = require( 'estree-walker' ).walk;

function runWebPPL() {
    const
    { spawnSync } = require( 'child_process' ),
    //out = spawnSync( 'webppl', [ './temp.wppl' ] );
    out = spawnSync( 'node', [ './node_modules/webppl/webppl', './temp.wppl' ] );

    return out.stdout.toString();
}

function inferProbability(edge) {
    console.log("EDGE");
    console.log(edge);
    console.log();

    let program = "var m = function() {\n";

    edge.code.forEach(function(blockLevel) {
        blockLevel.forEach(function(line) {
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

function rebuildFunc(funcCFI) {
    //lets assume the first node is the start
    digraphe.Visitor.BFS(funcCFI, funcCFI.flowGraph.nodes[0].id.toString(), function (array_of_nodes, depth) {
    });
}

var defaultFuncs = ['flip']
function checkForCallExp(   ast, rewrittenProgram, controlFlowInfo, incomingProbability, incomingCode, 
                            incomingConditions, blockLevel, functionLevel) {
    walk(ast, {
        enter: function ( node, parent ) {
            if (node.type === 'CallExpression' && !defaultFuncs.includes(node.callee.name)) {   
                let funcCFI = controlFlowInfo.functions.find(x => x.varName === node.callee.varName);    
                let graph = loadGraph(funcCFI.flowGraph);
                functionLevel++;
                visitCFG(
                    graph, funcCFI.flowGraph.entry.id.toString(), rewrittenProgram, controlFlowInfo, 
                    incomingProbability, incomingCode, incomingConditions, blockLevel, functionLevel, 
                    node.arguments
                );
                functionLevel--;
            }
        },
        leave: function ( node, parent ) {
            // some code happens
        }
    });
}

function renameVarsByFunctionScope(ast, functionLevel) {
    walk(ast, {
        enter: function ( node, parent ) {
            if (node.type === 'Identifier') {  
                node.varName = typeof node.varName === 'undefined' ? node.name : node.varName;
                var funcRegex = /\$\$func[0-9]+/;
                var paramRegex = /\$\$params/;
                var funcMatch = node.name.match(funcRegex);
                var paramMatch = paramRegex.exec(node.name);
                if(funcMatch == null && paramMatch == null && !defaultFuncs.includes(node.varName)) {
                    node.name = node.name + "_" + functionLevel.toString();
                }
            }
        },
    });
}

function visitCFG(  graph, head, rewrittenProgram, controlFlowInfo, initialProbability, initialCode, 
                    initialConditions, initialBlockLevel, initialFunctionLevel, args, nodeConditioningInfo = null) {
    let cfgAnalyzer = new CFGAnalyzer();
    //visit the graph
    let reVisit = false;
    do {

        let blockLevel = initialBlockLevel;

        let reVisiting = false;
        if (reVisit) {
            reVisiting = true;
        }

        reVisit = false;
        digraphe.Visitor.BFS(graph, head, function (array_of_nodes, depth) {
            console.log("DEPTH: " + depth);
            array_of_nodes.forEach(function(node) {
                let nodeReady = true; 
                let nodeVisited = false;
                let incomingEdges = node.object.incomingEdges.length;
                let outgoingEdges = node.object.outgoingEdges.length;

                if (incomingEdges > 1) blockLevel--;

                //if this is not ready to visit
                node.object.incomingEdges.forEach(function(edge) {
                    if (typeof edge.probability === 'undefined') {
                        reVisit = true;
                        nodeReady = false;                       
                    }
                    console.log(edge.source.id + " --> " + edge.target.id + ": " + edge.label);
                });

                /*if this has been visited before
                node.object.outgoingEdges.forEach(function(edge) {
                    if (!(typeof edge.probability === 'undefined')) {
                        nodeVisited = true;
                    } 
                });*/

                //skip this iteration if not ready or not visited
                if (!nodeReady || nodeVisited) return;

                let incomingProbability = 0;
                let incomingCode = null;
                let incomingConditions = null;
                let incomingIgnoreBranch = null;

                //calculate the incoming total prob to this node
                if (incomingEdges == 0) {
                    incomingProbability = initialProbability;
                    incomingCode = initialCode;
                    incomingConditions = initialConditions;
                    incomingIgnoreBranch = false;
                    
                } else if (incomingEdges == 1) {
                    let incomingEdge0 = node.object.incomingEdges[0]

                    incomingProbability = incomingEdge0.probability;
                    incomingCode = incomingEdge0.code;
                    incomingConditions = incomingEdge0.conditions;
                    incomingIgnoreBranch = incomingEdge0.ignoreBranch;

                } else if (incomingEdges == 2) {
                    

                    let incomingEdge0 = node.object.incomingEdges[0]
                    let incomingEdge1 = node.object.incomingEdges[1]

                    incomingProbability = incomingEdge0.probability + incomingEdge1.probability;           
                    incomingEdge1.code.pop();
                    incomingCode = incomingEdge1.code;           
                    incomingEdge1.conditions.pop();
                    incomingConditions = incomingEdge1.conditions;
                    incomingIgnoreBranch = !incomingEdge0.ignoreBranch || !incomingEdge1.ignoreBranch;

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

                    let code = '';
                    if (outgoingEdge0.label != "") {
                        renameVarsByFunctionScope(outgoingEdge0.data, initialFunctionLevel);                
                        code = Escodegen.generate(outgoingEdge0.data);
                    }
                    
                    if (code != '' && (outgoingEdge0.data.type == 'VariableDeclarator' || outgoingEdge0.data.type == 'AssignmentExpression')) {
                        code = "var " + code;
                        var funcRegex = /\$\$func[0-9]+/;
                        var match = code.match(funcRegex);
                        if(match != null) {
                            let func = match[0];
                            let funcCFI = controlFlowInfo.functions.find(x => x.name === func);
                            funcCFI.varName = outgoingEdge0.data.id.varName;
                            let funcAST = rewrittenProgram.body.find(x => x.id.name === func);
                            let funcCode = Escodegen.generate(funcAST);
                            funcCode = funcCode.replace(funcRegex, "");
                            code = code.replace(funcRegex, funcCode);
                        }

                        var paramRegex = /\$\$params\[([0-9]+)\]/;
                        match = paramRegex.exec(code);
                        if(match != null) {
                            let paramIndex = match[1];
                            let paramCode = Escodegen.generate(args[paramIndex]);
                            code = code.replace(paramRegex, paramCode);
                        }
                    }

                    if (!incomingIgnoreBranch) checkForCallExp(outgoingEdge0.data, rewrittenProgram, controlFlowInfo, incomingProbability, incomingCode, incomingConditions, blockLevel, initialFunctionLevel);

                    // console.log("AKJSDLASD");
                    // console.log(incomingCode);
                    // console.log(blockLevel);
                    // console.log("END");
                    incomingCode[blockLevel].push(code);
                    outgoingEdge0.code = incomingCode;

                    outgoingEdge0.conditions = incomingConditions;

                    outgoingEdge0.ignoreBranch = incomingIgnoreBranch;

                } else if (outgoingEdges == 2) {
                    blockLevel++;

                    let outgoingEdge0 = node.object.outgoingEdges[0];
                    let outgoingEdge1 = node.object.outgoingEdges[1];

                    outgoingEdge0.code = incomingCode.slice();
                    outgoingEdge1.code = incomingCode.slice();

                    renameVarsByFunctionScope(outgoingEdge0.data, initialFunctionLevel); 

                    outgoingEdge0.conditions = incomingConditions.slice();
                    let outgoingEdge0Condition = Escodegen.generate(outgoingEdge0.data);
                    outgoingEdge0.conditions.push(outgoingEdge0Condition);

                    outgoingEdge1.conditions = incomingConditions.slice();        
                    let outgoingEdge1Condition = Escodegen.generate(outgoingEdge1.data);
                    outgoingEdge1.conditions.push(outgoingEdge1Condition);

                    // Node conditioning
                    if (nodeConditioningInfo !== null) {
                        if (nodeConditioningInfo.gatherConditions === true) {
                            // cfgAnalyzer.performNodeConditioning(
                            //     nodeConditioningInfo.viableEdges, outgoingEdge0, outgoingEdge1, blockLevel
                            // );

                            let viableEdges = nodeConditioningInfo.viableEdges;
                            if (!(  ( viableEdges.includes(outgoingEdge0) &&  viableEdges.includes(outgoingEdge1)) ||
                                    (!viableEdges.includes(outgoingEdge0) && !viableEdges.includes(outgoingEdge1))  )) {
                                let conditioningAssumption = "";
                                let undefinedCheck = "if (true";
                                let firstCondition = true;
                                let conditionsToAssume = viableEdges.includes(outgoingEdge0) ? outgoingEdge0.conditions : outgoingEdge1.conditions;
                                conditionsToAssume.forEach(function(c) {
                                    if (firstCondition) {
                                        firstCondition = false;
                                    }
                                    else {
                                        conditioningAssumption += " && ";
                                    }
                                    conditioningAssumption += c;

                                    undefinedCheck += ' && typeof ' + c + ' !== \'undefined\''
                                });
                                undefinedCheck += ") ";
                    
                                let conditioningCode = undefinedCheck + "condition(" + conditioningAssumption + ")";
                                if (typeof nodeConditioningInfo.conditionsMap[blockLevel - 1] === 'undefined') {
                                    nodeConditioningInfo.conditionsMap[blockLevel - 1] = [ conditioningCode ];
                                }
                                else {
                                    nodeConditioningInfo.conditionsMap[blockLevel - 1].push(conditioningCode);
                                }
                            }
                        }
                        else {
                            if (typeof nodeConditioningInfo.conditionsMap[blockLevel - 1] !== 'undefined') {
                                nodeConditioningInfo.conditionsMap[blockLevel - 1].forEach(function(conditioningCode) {
                                    outgoingEdge0.code[blockLevel - 1].push(conditioningCode);
                                });
                            }
                        }
                    }

                    let inferredProbability0 = inferProbability(outgoingEdge0);
                    let inferredProbability1 = inferProbability(outgoingEdge1);

                    if (outgoingEdge0.probability && !reVisiting) {
                        //use addition rule                     
                        outgoingEdge0.probability = (outgoingEdge0.probability + inferredProbability0) - (outgoingEdge0.probability * inferredProbability0);        
                    } else {
                        outgoingEdge0.probability = inferredProbability0;
                    }
                    if (outgoingEdge1.probability && !reVisiting) {
                        //use addition rule                     
                        outgoingEdge1.probability = (outgoingEdge1.probability + inferredProbability1) - (outgoingEdge1.probability * inferredProbability1);  
                    } else {
                        outgoingEdge1.probability = inferredProbability1;
                    }

                    if (inferredProbability0 != 0) {
                        checkForCallExp(outgoingEdge0.data, rewrittenProgram, controlFlowInfo, incomingProbability, incomingCode, incomingConditions, blockLevel, initialFunctionLevel);
                        outgoingEdge0.ignoreBranch = false;
                    } else {
                        outgoingEdge0.ignoreBranch = true;
                    }
                    if (inferredProbability1 != 0) {
                        checkForCallExp(outgoingEdge1.data, rewrittenProgram, controlFlowInfo, incomingProbability, incomingCode, incomingConditions, blockLevel, initialFunctionLevel);
                        outgoingEdge1.ignoreBranch = false;
                    } else {
                        outgoingEdge1.ignoreBranch = true;
                    }

                } else {
                    console.log("error");
                    return;
                }

            });
        });
    } while(reVisit);
}

function loadGraph(flowGraph) {
    //load control flow graph into graph structure
    let graph = new digraphe();
    flowGraph.nodes.forEach(function(node) {
        graph.addNode(node.id.toString(), node);
    });
    flowGraph.edges.forEach(function(edge) {
        graph.addEdge(edge.source.id.toString(), edge.target.id.toString());
    });

    return graph;
}

function createVisualization(elements) {
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
        fs.writeFile(outputPNGFile, base64Data, 'base64', function(err) {
            if(err) {
                return console.log(err);
            }
            process.exit()
        });
    });
}

function displayUsage() {
    console.log("Usage: node webPPLCFG.js [options] program_file");
    console.log("   options:");
    console.log("       -o <filename>   Name of .png file to output CFG to");
    console.log("       -r              Remove unreachable nodes from CFG");
    console.log("       -c <nodeID>     Condition CFG through node given by nodeID");
}

// Get command line arguments
let argv = parseArgs(process.argv);

if (argv._.length !== 3) {
    displayUsage();
    process.exit(1);
}

let programFile = argv._[2];
let oOption = typeof argv.o !== 'undefined';
let outputPNGFile = oOption ? argv.o : "out.png";
let rOption = typeof argv.r !== 'undefined';
let cOption = typeof argv.c !== 'undefined';
let cOptionValue = argv.c;

fs.readFile(programFile, 'utf8', function(err, code) {
    if (err) {
        console.log(err);
        return;
    }

    //create the ast
    let ast = Esprima.parse(code);

    //create the plain control flow graph
    let controlFlowInfo = Styx.parse(ast);

    var rewrittenProgram = AstPreprocessing.rewriteFunctionExpressions(ast);

    let graph = loadGraph(controlFlowInfo.flowGraph);

    let cfgAnalyzer = new CFGAnalyzer();
    let nodeConditioningInfo = null;
    if (cOption) {
        let viableEdges = cfgAnalyzer.getEdgesOfPathsThroughNode(graph, controlFlowInfo.flowGraph, cOptionValue);
        if (viableEdges !== null) {
            nodeConditioningInfo = { 
                'viableEdges': viableEdges, 
                'gatherConditions': true,
                'conditionsMap': {}
            };
        }
        visitCFG(graph, controlFlowInfo.flowGraph.entry.id.toString(), rewrittenProgram, controlFlowInfo, 1, [], [], 0, 0, null, nodeConditioningInfo);
        
        console.log("CONDITIONS MAP");
        console.log(nodeConditioningInfo.conditionsMap);
        console.log();
        controlFlowInfo = Styx.parse(ast);
        rewrittenProgram = AstPreprocessing.rewriteFunctionExpressions(ast);
        graph = loadGraph(controlFlowInfo.flowGraph);
        nodeConditioningInfo.gatherConditions = false;
    }
    visitCFG(graph, controlFlowInfo.flowGraph.entry.id.toString(), rewrittenProgram, controlFlowInfo, 1, [], [], 0, 0, null, nodeConditioningInfo);

    if (rOption) {
        cfgAnalyzer.removeUnreachableNodes(graph, controlFlowInfo.flowGraph);
        controlFlowInfo.functions.forEach(function(func){
            cfgAnalyzer.removeUnreachableNodes(loadGraph(func.flowGraph),func.flowGraph);
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
    controlFlowInfo.functions.forEach(function(func) {
        func.flowGraph.nodes.forEach(function(node) {
            elements.nodes.push({data: { id: node.id.toString() }})
        });
        func.flowGraph.edges.forEach(function(edge) {
            elements.edges.push({data: { source: edge.source.id.toString(), target: edge.target.id.toString(), name: edge.label + ", " + edge.probability }});
        });
    });

    createVisualization(elements);
});
