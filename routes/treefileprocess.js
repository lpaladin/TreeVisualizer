var fs = require('fs');
var readline = require('readline');
var stream = require('stream');
var TreeNode = (function () {
    function TreeNode(parent, data, id) {
        this.parent = parent;
        this.data = data;
        this.id = id;
        this.children = [];
        if (!this.data)
            this.data = "";
        if (this.parent) {
            this.indexInParentArray = this.parent.children.length;
            this.parent.children.push(this);
            this.depth = this.parent.depth + 1;
        }
        else {
            this.depth = 0;
            this.indexInParentArray = 0;
        }
    }
    TreeNode.prototype.toJSON = function () {
        var result = '{"id":' + this.id + ',"name":"' +
            this.data.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0') +
            '"';
        if (this.children.length > 0) {
            result += ',"children":[' + this.children[0].toJSON();
            for (var i = 1; i < this.children.length; i++)
                result += ',' + this.children[i].toJSON();
            result += ']';
        }
        return result + '}';
    };
    return TreeNode;
})();
exports.TreeNode = TreeNode;
;
;
exports.tels = {
    dummy: {
        onModifyNode: function (tree, node) {
        },
        onNewNode: function (tree, node) {
        }
    },
    standard: {
        onModifyNode: function (tree, node) {
            tree.yieldDisplayMessage({
                nodeUniqueID: node.id,
                operation: "Update",
                data: node.data
            });
        },
        onNewNode: function (tree, node) {
            tree.yieldDisplayMessage({
                nodeUniqueID: (node.parent || { id: -1 }).id,
                operation: "AppendChild",
                data: node.data,
                newNodeID: node.id
            });
        }
    },
    lite: {
        onModifyNode: function (tree, node) {
            if (!node.parent || node.parent.children.length - node.indexInParentArray < 6)
                tree.yieldDisplayMessage({
                    nodeUniqueID: node.id,
                    operation: "Update",
                    data: node.data
                });
        },
        onNewNode: function (tree, node) {
            if (node.parent && node.parent.children.length > 5) {
                var nodeToRemove = node.parent.children[node.parent.children.length - 6];
                tree.yieldDisplayMessage({
                    nodeUniqueID: nodeToRemove.id,
                    operation: "Remove",
                    data: nodeToRemove.data
                });
            }
            tree.yieldDisplayMessage({
                nodeUniqueID: (node.parent || { id: -1 }).id,
                operation: "AppendChild",
                data: node.data,
                newNodeID: node.id
            });
        }
    }
};
var Tree = (function () {
    /*
     * 文件应当是 UTF-8 编码
     */
    function Tree(path, tel) {
        this.path = path;
        this.tel = tel;
        this.nodes = [];
        this.yieldBuffer = [];
    }
    Tree.prototype.pause = function () {
        this.rl.pause();
    };
    Tree.prototype.resume = function () {
        this.rl.resume();
    };
    Tree.prototype.yieldDisplayMessage = function (msg) {
        this.yieldBuffer.push(msg);
        if (this.haste)
            return;
        if (this.yieldBuffer.length >= 100)
            this.rl.pause();
        if (this.yieldCallback)
            this.yieldCallback();
    };
    Object.defineProperty(Tree.prototype, "started", {
        get: function () {
            return !!this.rl;
        },
        enumerable: true,
        configurable: true
    });
    Tree.prototype.begin = function () {
        var _this = this;
        var is = fs.createReadStream(this.path), os = new stream.Writable();
        // 按行读取输入流
        this.rl = readline.createInterface({
            input: is,
            output: os
        });
        this.rl.on('line', function (line) {
            if (line && line.length > 0)
                _this.parseLine(line);
        }).on('close', function () {
            _this.closed = true;
            if (_this.yieldCallback)
                _this.yieldCallback();
            if (_this.finalCallback)
                _this.finalCallback();
        });
    };
    Tree.prototype._fetch = function (count) {
        var results = this.yieldBuffer.splice(0, count);
        if (this.yieldBuffer.length + count >= 100)
            this.rl.resume();
        return results;
    };
    Tree.prototype.fetch = function (count, callback) {
        var _this = this;
        if (this.yieldBuffer.length < count) {
            if (this.closed)
                return callback(this.yieldBuffer, true);
            else
                this.yieldCallback = function () {
                    if (_this.yieldBuffer.length >= count || _this.closed) {
                        callback(_this._fetch(count), _this.yieldBuffer.length == 0 && _this.closed);
                        _this.yieldCallback = null;
                    }
                };
        }
        else
            callback(this._fetch(count), this.yieldBuffer.length == 0 && this.closed);
    };
    Tree.prototype.fetchFinal = function (callback) {
        var _this = this;
        if (this.closed)
            callback(this.nodes[0]);
        else {
            this.haste = true;
            this.finalCallback = function () { return callback(_this.nodes[0]); };
        }
    };
    Tree.prototype.destroy = function () {
        this.closed = true;
        this.rl.close();
        // 对垃圾回收器更加友好的显式释放
        // （并不确定……）
        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            node.children.length = 0;
            node.parent = null;
        }
        this.nodes.length = 0;
    };
    Tree.prototype.parseLine = function (line) {
        var tokens = line.split(" ", 3);
        if (tokens[0] != '*' && tokens[0] != '+') {
            // 是精简表达文件，即静态
            tokens[2] = tokens[1];
            tokens[1] = tokens[0];
            tokens[0] = '+';
        }
        if (tokens[0] == '+') {
            // TypeA： + 【父节点ID】 【附加信息】，表示增加结点
            var node;
            if (this.nodes.length == 0)
                this.nodes.push(node = new TreeNode(null, tokens[2], this.nodes.length));
            else
                this.nodes.push(node = new TreeNode(this.nodes[parseInt(tokens[1])], tokens[2], this.nodes.length));
            this.tel.onNewNode(this, node);
        }
        else {
            // TypeB： * 【目标结点ID】 【附加信息】，表示修改结点
            var node = this.nodes[parseInt(tokens[1])];
            node.data = tokens[2];
            this.tel.onModifyNode(this, node);
        }
    };
    return Tree;
})();
exports.Tree = Tree;
;
//# sourceMappingURL=treefileprocess.js.map