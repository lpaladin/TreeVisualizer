/*
 * GET home page.
 */
import express = require('express');
import tp = require('./treefileprocess');
import nedb = require('nedb');
import fs = require('fs');

var db = <nedb> global.db;
var treesInProcess: { [index: string]: tp.Tree } = {};

try { fs.mkdirSync("./trees"); } catch (e) { }

export function index(req: express.Request, res: express.Response): void {
    db.find(null)
        .sort({ $natural: -1 })
        .exec(function (err, docs) {
            res.render('index', { trees: docs });
        });
};

export function uploadtree(req: express.Request, res: express.Response): void {
    if (!req.body.title || req.body.title.length == 0 || !req.files.treefile)
        res.json({ success: false, message: res.__("missingfield") });
    else {
        var file: { size: number, path: string } = req.files.treefile;
        db.insert({
            title: req.body.title,
            date: new Date(),
            size: file.size
        }, function (err, doc) {
            if (err)
                res.json({ success: false, message: err });
            else {
                fs.renameSync(file.path, "./trees/" + (<any> doc)._id);
                res.json({ success: true });
            }
        });
    }
};

export function treeview(req: express.Request, res: express.Response): void {
    if (!req.params.id)
        res.redirect("/");
    else {
        var id;
        db.findOne({ _id: id = req.params.id }, function (err, doc) {
            res.render('treeview', { tree: doc });
        });
    }
};

export function playtree(socket: SocketIO.Socket): (data: PlayTreeArgument) => void {
    return function (data: PlayTreeArgument): void {
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
        treesInProcess[uniqueID].fetch(count, function (results: TreeDisplayOperation[], finished: boolean) {
            socket.emit('tree.newdisplay', { messages: results, finished: finished });
            if (finished) {
                if (treesInProcess[uniqueID])
                    treesInProcess[uniqueID].destroy();
                delete treesInProcess[uniqueID];
            }
        });
    };
};

export function showfinaltree(socket: SocketIO.Socket): (data: { treeid: string }) => void {
    return function (data: { treeid: string }): void {
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
        treesInProcess[uniqueID].fetchFinal(function (result: tp.TreeNode) {
            socket.emit('tree.finaldisplay', result);
            if (treesInProcess[uniqueID])
                treesInProcess[uniqueID].destroy();
            delete treesInProcess[uniqueID];
        });
    };
};