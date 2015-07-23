var socket: SocketIOClient.Socket;

function PullOperations(treeid: string): void {
    if (!socket)
        return;
    $("#btnPull, #btnPullFinal, #cmbDisplayMethod").addClass("disabled").attr("disabled", "disabled");
    $("#lblStatus").attr("class", "alert alert-warning").text("拉取中 / Pulling");
    socket.emit('playtree', {
        treeid: treeid, count: $("#txtPullCount").val(), method: $("#cmbDisplayMethod").val()
    });
}

function PullFinal(treeid: string): void {
    if (!socket)
        return;
    $("#btnPull, #btnPullFinal").addClass("disabled");
    $("#lblStatus").attr("class", "alert alert-warning").text("拉取中 / Pulling");
    FormConfig.ldscreen.fadeIn();
    socket.emit('showfinaltree', {
        treeid: treeid
    });
}

$(document).ready(function () {
    var canvas = $(".container > .row > .col-md-9");
    var diameter = Math.min(canvas.width(), canvas.height());

    var tree = d3.layout.tree()
        .size([360, diameter / 2 - 120])
        .separation((a, b) => a.parent == b.parent ? 1 : 2);

    var diagonal = d3.svg.diagonal();

    var svg = d3.select("svg#svgTreeView")
        .attr("width", diameter)
        .attr("height", diameter - 150)
        .append("g")
        .attr("transform", "translate(0, 0)");

    var fnTransform = (d: d3.layout.tree.Node) => "translate(" + d.x + "," + d.y + ")",
        fnTextTransform = (d: d3.layout.tree.Node) => "";

    function UpdateTree(root: any, toPoint: d3.layout.tree.Node) {
        var nodes = tree.nodes(root),
            links = tree.links(nodes);

        var link = svg.selectAll(".link")
            .data(links, (d: any) => d.target.id);

        link.enter().append("path")
            .attr("class", "link")
            .attr("d", (d) => {
                var o = { x: toPoint.x, y: toPoint.y };
                return (<any> diagonal)({ source: o, target: o });
            })
            .transition().duration(300)
            .attr("d", diagonal);

        link.transition().duration(300).attr("d", diagonal);

        link.exit().transition().duration(300)
            .attr("d", (d) => {
                var o = { x: toPoint.x, y: toPoint.y };
                return (<any> diagonal)({ source: o, target: o });
            })
            .remove();

        var node = svg.selectAll(".node")
            .data(nodes, (d: any) => d.id);

        node.exit().transition().duration(300)
            .attr("transform", fnTransform(toPoint))
            .remove();

        node.transition().duration(300)
            .attr("transform", fnTransform)
            .select("text")
            .attr("transform", fnTextTransform);

        var enteredNodes = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", fnTransform(toPoint))
            .on('click', (d) => {
                var tmp = d.children;
                d.children = (<any> d)._children;
                (<any> d)._children = tmp;
                UpdateTree(root, d);
            });

        enteredNodes.transition().duration(300)
            .attr("transform", fnTransform);

        enteredNodes.append("circle")
            .attr("r", 6);

        enteredNodes.append("text")
            .attr("dy", ".31em")
            .attr("text-anchor", (d) => d.x < 180 ? "start" : "end")
            .attr("transform", fnTextTransform)
            .text((d: any) => d.name);
    }

    socket = io();

    var dynamicTreeRoot, allNodes: D3TreeNode[] = [];

    socket.on('tree.newdisplay', function (d: DisplayData) {
        for (var i = 0; i < d.messages.length; i++) {
            var data = d.messages[i];
            switch (data.operation) {
                case "AppendChild":
                    var newNode: D3TreeNode = { name: data.data, parentID: data.nodeUniqueID, id: (<AppendChildTreeDisplayOperation> data).newNodeID };
                    if (data.nodeUniqueID == -1) {
                        dynamicTreeRoot = newNode;
                        allNodes[(<AppendChildTreeDisplayOperation> data).newNodeID] = newNode;
                    } else {
                        allNodes[(<AppendChildTreeDisplayOperation> data).newNodeID] = newNode;
                        if (!allNodes[data.nodeUniqueID].children)
                            allNodes[data.nodeUniqueID].children = [newNode];
                        else
                            allNodes[data.nodeUniqueID].children.push(newNode);
                    }
                    UpdateTree(dynamicTreeRoot, newNode);
                    break;
                case "Update":
                    allNodes[data.nodeUniqueID].name = data.data;
                    UpdateTree(dynamicTreeRoot, allNodes[data.nodeUniqueID]);
                    break;
                case "Remove":
                    var target = allNodes[data.nodeUniqueID], array = allNodes[target.parentID].children,
                        index = array.indexOf(target);
                    array.splice(index, 1);
                    delete allNodes[data.nodeUniqueID];
                    UpdateTree(dynamicTreeRoot, allNodes[target.parentID]);
                    break;
            }
        }
        
        if (!d.finished) {
            $("#btnPull, #btnPullFinal").removeClass("disabled").removeAttr("disabled");
            $("#lblStatus").attr("class", "alert alert-info").text("就绪 / Ready");
        } else
            $("#lblStatus").attr("class", "alert alert-success").text("终止状态 / Tree terminated");
    });

    socket.on('tree.finaldisplay', function (root: string) {
        svg.html("");
        UpdateTree(dynamicTreeRoot = JSON.parse(root), { x: 0, y: 0 });
        FormConfig.ldscreen.fadeOut();
        $("#lblStatus").attr("class", "alert alert-success").text("终止状态 / Tree terminated");
    });

    $("#cmbTreeLayout").change(function () {
        switch (this.value) {
            case "standard":
                tree.separation((a, b) => a.parent == b.parent ? 1 : 2);
                diagonal = d3.svg.diagonal();
                fnTransform = (d: d3.layout.tree.Node) => "translate(" + d.x + "," + d.y + ")";
                fnTextTransform = (d: d3.layout.tree.Node) => "";
                d3.select("svg#svgTreeView > g").transition().duration(300)
                    .attr("transform", "translate(0, 0)");
                break;
            case "radial":
                tree.separation((a, b) => a == b ? 1 : ((a.parent == b.parent ? 1 : 2) / a.depth));
                diagonal = d3.svg.diagonal.radial().projection((d) => [d.y, d.x / 180 * Math.PI]);
                fnTransform = (d: d3.layout.tree.Node) => "rotate(" + (d.x - 90) + ")translate(" + d.y + ")";
                fnTextTransform = (d: d3.layout.tree.Node) => "rotate(" + (90 - d.x) + ")translate(" + (d.x < 180 ? "" : "-") + "8)";
                d3.select("svg#svgTreeView > g").transition().duration(300)
                    .attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");
                break;
        }
        UpdateTree(dynamicTreeRoot, { x: 0, y: 0 });
    });
});