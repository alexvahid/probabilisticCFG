const digraphe = require('digraphe');

class CFGAnalyzer {
    constructor() {}

    removeUnreachableNodes(graph, flowGraph) {
        console.log("Removing unreachable nodes from CFG...");

        let head = flowGraph.entry.id.toString();
        
        digraphe.Visitor.BFS(graph, head, function (array_of_nodes, depth) {
            array_of_nodes.forEach(function(node) {
                node.object.reachable = true;
                let incomingEdges = node.object.incomingEdges;
                if (incomingEdges.length > 0) {
                    let nodeProbability = 0;
                    incomingEdges.forEach(function(incomingEdge) {
                        nodeProbability += incomingEdge.probability;
                    });
                    if (nodeProbability === 0) {
                        node.object.reachable = false;
                    }
                }
            });
        });

        let edges = flowGraph.edges;
        let numEdgesRemoved = 0;
        edges.forEach(function(edge, index, edgesObject) {
            if (!edge.source.reachable || !edge.target.reachable) {
                edgesObject.splice(index, 1);
                numEdgesRemoved++;
            }
        });

        let nodes = flowGraph.nodes;
        let numNodesRemoved = 0;
        nodes.forEach(function(node, index, nodesObject) {
            if (!node.reachable) {
                nodesObject.splice(index, 1);
                numNodesRemoved++;
            }
        });

        console.log(numNodesRemoved + " node(s) removed and " + numEdgesRemoved + " edge(s) removed.");
    }

    conditionThroughNode(graph, flowGraph, nodeID) {
        let nodeToConditionThrough = graph.nodes[nodeID].object;
        let nodes = [];
        nodes.push(nodeToConditionThrough);

        let viableEdges = [];
        while (nodes.length !== 0) {
            let node = nodes.shift();
            node.incomingEdges.forEach(function(edge) {
                viableEdges.push(edge);
                nodes.push(edge.source);
            });
        }
        digraphe.Visitor.BFS(graph, nodeID.toString(), function (array_of_nodes, depth) {
            array_of_nodes.forEach(function(node) {
                node = node.object;
                node.outgoingEdges.forEach(function(edge) {
                    viableEdges.push(edge);
                });
            });
        });
        
        let head = flowGraph.entry.id.toString();
        digraphe.Visitor.BFS(graph, head, function (array_of_nodes, depth) {
            array_of_nodes.forEach(function(node) {
                node = node.object;
                if (node.outgoingEdges.length > 1) {
                    let assumptions = [];
                    let addConditioning = false;
                    node.outgoingEdges.forEach(function(edge) {
                        if (viableEdges.includes(edge)) {
                            assumptions.push(edge.conditions);
                        }
                        else {
                            addConditioning = true;
                        }
                    });

                    if (addConditioning) {
                        let code = "condition((";
                        let firstAssumption = true;
                        assumptions.forEach(function(assumption) {
                            if (firstAssumption) {
                                firstAssumption = false;
                            }
                            else {
                                code += ") || (";
                            }

                            let firstCondition = true;
                            assumption.forEach(function(condition) {
                                if (firstCondition) {
                                    firstCondition = false;
                                }
                                else {
                                    code += " && ";
                                }
                                code += condition;
                            });
                        });

                        code += "))";

                        node.incomingEdges.forEach(function(edge) {
                            if (edge.code.length > 0) {
                                edge.code[edge.code.length - 1].push(code);
                            }
                        });
                    }
                }
            });
        });
    }

    debug(graph, flowGraph) {
        let head = flowGraph.entry.id.toString();
        digraphe.Visitor.BFS(graph, head, function(array_of_nodes, depth) {
            console.log("DEPTH: " + depth);
            array_of_nodes.forEach(function(node) {
                let outgoingEdges = node.object.outgoingEdges;
                outgoingEdges.forEach(function (edge) {
                    console.log(edge);
                    console.log(edge.code);
                    console.log("");
                });
            });
        });
    }
}

module.exports = CFGAnalyzer;
