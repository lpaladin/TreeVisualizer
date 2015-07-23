// 不会编译

interface DisplayData {
    messages: TreeDisplayOperation[];
    finished: boolean;
}

interface TreeDisplayOperation {
    nodeUniqueID: number; // -1表示增加根结点
    operation: string; // ['AppendChild', 'Remove', 'Update']
    data: string;
}

interface AppendChildTreeDisplayOperation extends TreeDisplayOperation {
    newNodeID: number;
}

interface D3TreeNode {
    id: number;
    name: string;
    children?: D3TreeNode[];
    parentID?: number; // 自用
}

interface PlayTreeArgument {
    treeid: string;
    count: number;
    method: string;
}