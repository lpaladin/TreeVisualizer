var tp = require('./treefileprocess');
var fs = require('fs');
var db = global.db;
var treesInProcess = {};
try {
    fs.mkdirSync("./trees");
}
catch (e) { }
function index(req, res) {
    db.find(null)
        .sort({ $natural: -1 })
        .exec(function (err, docs) {
        res.render('index', { trees: docs });
    });
}
exports.index = index;
;
function uploadtree(req, res) {
    if (!req.body.title || req.body.title.length == 0 || !req.files.treefile)
        res.json({ success: false, message: res.__("missingfield") });
    else {
        var file = req.files.treefile;
        db.insert({
            title: req.body.title,
            date: new Date(),
            size: file.size
        }, function (err, doc) {
            if (err)
                res.json({ success: false, message: err });
            else {
                fs.renameSync(file.path, "./trees/" + doc._id);
                res.json({ success: true });
            }
        });
    }
}
exports.uploadtree = uploadtree;
;
function treeview(req, res) {
    if (!req.params.id)
        res.redirect("/");
    else {
        var id;
        db.findOne({ _id: id = req.params.id }, function (err, doc) {
            res.render('treeview', { tree: doc });
        });
    }
}
exports.treeview = treeview;
;
function playtree(socket) {
    return function (data) {
        var id = data.treeid, count = data.count, method = data.method;
        var uniqueID = id + socket.id;
        if (!treesInProcess[uniqueID]) {
            treesInProcess[uniqueID] = new tp.Tree("./trees/" + id, tp.tels[method]);
            treesInProcess[uniqueID].begin();
            socket.on('disconnect', function () {
                if (treesInProcess[uniqueID])
                    treesInProcess[uniqueID].destroy();
                delete treesInProcess[uniqueID];
            });
        }
        treesInProcess[uniqueID].fetch(count, function (results, finished) {
            socket.emit('tree.newdisplay', { messages: results, finished: finished });
            if (finished) {
                if (treesInProcess[uniqueID])
                    treesInProcess[uniqueID].destroy();
                delete treesInProcess[uniqueID];
            }
        });
    };
}
exports.playtree = playtree;
;
function showfinaltree(socket) {
    return function (data) {
        var id = data.treeid;
        var uniqueID = id + socket.id;
        if (!treesInProcess[uniqueID]) {
            treesInProcess[uniqueID] = new tp.Tree("./trees/" + id, tp.tels['standard']);
            treesInProcess[uniqueID].begin();
            socket.on('disconnect', function () {
                if (treesInProcess[uniqueID])
                    treesInProcess[uniqueID].destroy();
                delete treesInProcess[uniqueID];
            });
        }
        treesInProcess[uniqueID].fetchFinal(function (result) {
            socket.emit('tree.finaldisplay', result);
            if (treesInProcess[uniqueID])
                treesInProcess[uniqueID].destroy();
            delete treesInProcess[uniqueID];
        });
    };
}
exports.showfinaltree = showfinaltree;
;
//# sourceMappingURL=index.js.map