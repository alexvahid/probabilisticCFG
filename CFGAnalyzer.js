const digraphe = require('digraphe');

class CFGAnalyzer {
    constructor() {

    }

    removeUnreachableNodes(graph, flowGraph) {
        console.log("Removing unreachable nodes from CFG...");

        let head = flowGraph.entry.id.toString()
        
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
}

module.exports = CFGAnalyzer;
