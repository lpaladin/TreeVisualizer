import fs = require('fs');
import readline = require('readline');
import stream = require('stream');

export class TreeNode {
    public children: TreeNode[];
    public depth: number;
    public indexInParentArray: number;
    public constructor(public parent: TreeNode, public data: string, public id: number) {
        this.children = [];
        if (!this.data)
            this.data = "";
        if (this.parent) {
            this.indexInParentArray = this.parent.children.length;
            this.parent.children.push(this);
            this.depth = this.parent.depth + 1;
        } else {
            this.depth = 0;
            this.indexInParentArray = 0;
        }
    }
    public toJSON() {
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
    }
};

export interface TreeEventListener { // 实际上定义一种树的呈现形式
    onNewNode: (tree: Tree, node: TreeNode) => void;
    onModifyNode: (tree: Tree, node: TreeNode) => void;
};

export var tels: { [name: string]: TreeEventListener } = {
    dummy: { // 不实时返回
        onModifyNode: function (tree: Tree, node: TreeNode): void {

        },
        onNewNode: function (tree: Tree, node: TreeNode): void {

        }
    },
    standard: { // 返回整棵树
        onModifyNode: function (tree: Tree, node: TreeNode): void {
            tree.yieldDisplayMessage({
                nodeUniqueID: node.id,
                operation: "Update",
                data: node.data
            });
        },
        onNewNode: function (tree: Tree, node: TreeNode): void {
            tree.yieldDisplayMessage({
                nodeUniqueID: (node.parent || { id: -1 }).id,
                operation: "AppendChild",
                data: node.data,
                newNodeID: node.id
            });
        }
    },
    lite: { // 返回最近的5个结点
        onModifyNode: function (tree: Tree, node: TreeNode): void {
            if (!node.parent || node.parent.children.length - node.indexInParentArray < 6)
                tree.yieldDisplayMessage({
                    nodeUniqueID: node.id,
                    operation: "Update",
                    data: node.data
                });
        },
        onNewNode: function (tree: Tree, node: TreeNode): void {
            if (node.parent && node.parent.children.length > 5) { // 超过5个的话删除最早的兄弟
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

export class Tree {
    private nodes: TreeNode[];
    private rl: readline.ReadLine;
    private yieldBuffer: TreeDisplayOperation[];
    private closed: boolean;
    private haste: boolean;
    private yieldCallback: () => void;
    private finalCallback: () => void;

    public pause(): void {
        this.rl.pause();
    }

    public resume(): void {
        this.rl.resume();
    }

    public yieldDisplayMessage(msg: TreeDisplayOperation): void {
        this.yieldBuffer.push(msg);
        if (this.haste)
            return;
        if (this.yieldBuffer.length >= 100)
            this.rl.pause();
        if (this.yieldCallback)
            this.yieldCallback();
    }

    public get started(): boolean {
        return !!this.rl;
    }
    
    /*
     * 文件应当是 UTF-8 编码
     */
    public constructor(private path: string, private tel: TreeEventListener) {
        this.nodes = [];
        this.yieldBuffer = [];
    }

    public begin(): void {
        var is = fs.createReadStream(this.path),
            os = new stream.Writable();

        // 按行读取输入流
        this.rl = readline.createInterface({
            input: is,
            output: os
        });

        this.rl.on('line', (line: string) => {
            if (line && line.length > 0)
                this.parseLine(line);
        }).on('close', () => {
            this.closed = true;
            if (this.yieldCallback)
                this.yieldCallback();
            if (this.finalCallback)
                this.finalCallback();
        });
    }
    
    private _fetch(count: number): TreeDisplayOperation[] {
        var results = this.yieldBuffer.splice(0, count);
        if (this.yieldBuffer.length + count >= 100)
            this.rl.resume();
        return results;
    }

    public fetch(count: number, callback: (results: TreeDisplayOperation[], finished: boolean) => void): void {
        if (this.yieldBuffer.length < count) {
            if (this.closed)
                return callback(this.yieldBuffer, true);
            else
                this.yieldCallback = () => {
                    if (this.yieldBuffer.length >= count || this.closed) {
                        callback(this._fetch(count), this.yieldBuffer.length == 0 && this.closed);
                        this.yieldCallback = null;
                    }
                };
        } else 
            callback(this._fetch(count), this.yieldBuffer.length == 0 && this.closed);
    }

    public fetchFinal(callback: (result: TreeNode) => void): void {
        if (this.closed)
            callback(this.nodes[0]);
        else {
            this.haste = true;
            this.finalCallback = () => callback(this.nodes[0]);
        }
    }

    public destroy(): void {
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
    }

    private parseLine(line: string): void {
        var tokens = line.split(" ", 3);

        if (tokens[0] != '*' && tokens[0] != '+') {
            // 是精简表达文件，即静态

            tokens[2] = tokens[1];
            tokens[1] = tokens[0];
            tokens[0] = '+';
        }

        if (tokens[0] == '+') {
            // TypeA： + 【父节点ID】 【附加信息】，表示增加结点

            var node: TreeNode;
            if (this.nodes.length == 0)
                this.nodes.push(
                    node = new TreeNode(
                        null,
                        tokens[2],
                        this.nodes.length)
                    );
            else
                this.nodes.push(
                    node = new TreeNode(
                        this.nodes[parseInt(tokens[1])],
                        tokens[2],
                        this.nodes.length)
                    );

            this.tel.onNewNode(this, node);

        } else {
            // TypeB： * 【目标结点ID】 【附加信息】，表示修改结点

            var node = this.nodes[parseInt(tokens[1])];
            node.data = tokens[2];

            this.tel.onModifyNode(this, node);
        }
    }
};