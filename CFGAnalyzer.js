const digraphe = require('digraphe');
const fs = require('fs');

class CFGAnalyzer {
    constructor() {}

    getAllEdges(graph, flowGraph) {
        let edges = [];
        let head = flowGraph.entry.id.toString();
        digraphe.Visitor.BFS(graph, head, function(array_of_nodes, depth) {
            array_of_nodes.forEach(function(node) {
                node = node.object;
                node.outgoingEdges.forEach(function(edge) {
                    edges.push(edge);
                });
            });
        });

        return edges;
    }

    getIncomingEdgesOfNode(graph, nodeID) {
        if (typeof graph.nodes[nodeID] === 'undefined' || graph.nodes[nodeID] === null) {
            return null;
        }
        
        let node = graph.nodes[nodeID].object;
        let edges = [];
        node.incomingEdges.forEach(function(edge) {
            edges.push(edge);
        });

        return edges;
    }

    checkForValidPaths(graph, flowGraph, edges) {
        let headID = flowGraph.entry.id.toString();
        let head = graph.nodes[headID].object;
        let nodes = [ head ];

        while (nodes.length !== 0) {
            let node = nodes.shift();
            if (typeof node.outgoingEdges === 'undefined' || node.outgoingEdges === null || node.outgoingEdges.length <= 0) {
                return true;
            }

            node.outgoingEdges.forEach(function(edge) {
                if (edges.includes(edge)) {
                    nodes.push(edge.target);
                }
            });
        }

        return false;
    }

    getEdgesOfPathsThroughNode(graph, flowGraph, nodeID) {
        if (typeof graph.nodes[nodeID] === 'undefined' || graph.nodes[nodeID] === null) {
            return null;
        }
        
        let conditionNode = graph.nodes[nodeID].object;
        let nodes = [ conditionNode ];

        let viableEdges = [];
        while (nodes.length !== 0) {
            let node = nodes.shift();
            node.incomingEdges.forEach(function(edge) {
                viableEdges.push(edge);
                nodes.push(edge.source);
            });
        }
        digraphe.Visitor.BFS(graph, nodeID.toString(), function(array_of_nodes, depth) {
            array_of_nodes.forEach(function(node) {
                node = node.object;
                node.outgoingEdges.forEach(function(edge) {
                    viableEdges.push(edge);
                });
            });
        });

        return viableEdges;
    }

    performNodeConditioning(viableEdges, outgoingEdge0, outgoingEdge1, blockLevel) {
        if (!(  ( viableEdges.includes(outgoingEdge0) &&  viableEdges.includes(outgoingEdge1)) ||
                (!viableEdges.includes(outgoingEdge0) && !viableEdges.includes(outgoingEdge1))  )) {
            let conditioningAssumption = "";
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
            });

            let conditioningCode = "condition(" + conditioningAssumption + ")";
            outgoingEdge0.code[blockLevel - 1].push(conditioningCode);
        }
    }

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

    union(list1, list2) {
        let list = [];
        for (let i = 0; i < list1.length; i++) {
            list.push(list1[i]);
        }
        for (let i = 0; i < list2.length; i++) {
            let item = list2[i];
            if (!list.includes(item)) {
                list.push(item);
            }
        }

        return list;
    }

    intersection(list1, list2) {
        let list = [];
        for (let i = 0; i < list1.length; i++) {
            let item = list1[i];
            if (list2.includes(item)) {
                list.push(item);
            }
        }

        return list;
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

    // conditionThroughNode(graph, flowGraph, nodeID) {
    //     let conditionNode = graph.nodes[nodeID].object;
    //     let nodes = [ conditionNode ];

    //     let viableEdges = [];
    //     while (nodes.length !== 0) {
    //         let node = nodes.shift();
    //         node.incomingEdges.forEach(function(edge) {
    //             viableEdges.push(edge);
    //             nodes.push(edge.source);
    //         });
    //     }
    //     digraphe.Visitor.BFS(graph, nodeID.toString(), function(array_of_nodes, depth) {
    //         array_of_nodes.forEach(function(node) {
    //             node = node.object;
    //             node.outgoingEdges.forEach(function(edge) {
    //                 viableEdges.push(edge);
    //             });
    //         });
    //     });

    //     let head = flowGraph.entry.id.toString();
    //     digraphe.Visitor.BFS(graph, head, function(array_of_nodes, depth) {
    //         array_of_nodes.forEach(function(node) {
    //             node = node.object;
    //             if (node.outgoingEdges.length > 1) {
    //                 let assumption = "";

    //                 let addConditioning = true;
    //                 let outgoingEdge0 = node.outgoingEdges[0];
    //                 let outgoingEdge1 = node.outgoingEdges[1];
    //                 if (    ( viableEdges.includes(outgoingEdge0) &&  viableEdges.includes(outgoingEdge1)) ||
    //                         (!viableEdges.includes(outgoingEdge0) && !viableEdges.includes(outgoingEdge1)) ||
    //                         (outgoingEdge0.conditions.length <= 0 && outgoingEdge1.conditions.length <= 0) ||
    //                         (outgoingEdge0.conditions.length === outgoingEdge1.conditions.length)   ) {
    //                     addConditioning = false;
    //                 }
    //                 else {
    //                     if (outgoingEdge0.conditions.length > outgoingEdge1.conditions.length) {
    //                         assumption += outgoingEdge0.conditions[outgoingEdge0.conditions.length - 1];
    //                         outgoingEdge1.conditions.push("!(" + assumption + ")");
    //                         if (viableEdges.includes(outgoingEdge0)) {
    //                             assumption = "(" + assumption + ")";
    //                         }
    //                         else {
    //                             assumption = "!(" + assumption + ")";
    //                         }
    //                     }
    //                     else {
    //                         assumption += outgoingEdge1.conditions[outgoingEdge1.conditions.length - 1];
    //                         outgoingEdge0.conditions.push("!(" + assumption + ")");
    //                         if (viableEdges.includes(outgoingEdge1)) {
    //                             assumption = "(" + assumption + ")";
    //                         }
    //                         else {
    //                             assumption = "!(" + assumption + ")";
    //                         }
    //                     }
    //                 }

    //                 if (addConditioning) {
    //                     let code = "condition(" + assumption + ")";
    //                     node.incomingEdges.forEach(function(edge) {
    //                         if (edge.code.length > 0) {
    //                             edge.code[edge.code.length - 1].push(code);
    //                         }
    //                     });
    //                 }
    //             }
    //         });
    //     });

    //     this.evaluateCFG(graph, flowGraph);
    // }

    // evaluateCFG(graph, flowGraph) {
    //     let self = this;
    //     let head = flowGraph.entry.id.toString();
    //     digraphe.Visitor.BFS(graph, head, function (array_of_nodes, depth) {
    //         array_of_nodes.forEach(function(node) {
    //             node = node.object;

    //             let incomingProbability = 0;
    //             if (node.incomingEdges.length <= 0) {
    //                 incomingProbability = 1;
    //             }
    //             else if (node.incomingEdges.length === 1) {
    //                 incomingProbability = node.incomingEdges[0].probability;
    //             }
    //             else {
    //                 node.incomingEdges.forEach(function(edge) {
    //                     incomingProbability += edge.probability;
    //                 });
    //             }

    //             if (node.outgoingEdges.length === 1) {
    //                 node.outgoingEdges[0].probability = incomingProbability;
    //             }
    //             else if (node.outgoingEdges.length > 1) {
    //                 node.outgoingEdges.forEach(function(edge) {
    //                     edge.probability = self.inferProbability(edge);
    //                 });
    //             }
    //         });
    //     });
    // }
}

module.exports = CFGAnalyzer;
