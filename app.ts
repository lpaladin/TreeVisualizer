import express = require('express');
import http = require('http');
import path = require('path');
import i18n = require('i18n');
import swig = require('swig');
import socketio = require('socket.io');
import nedb = require('nedb');

// 创建轻型存储数据库，存储全局参数
global.db = new nedb({ filename: "./ne.db", autoload: true });

var app = express();

i18n.configure({
    locales: ['en', 'zh'],
    defaultLocale: 'zh',
    directory: __dirname + '/locales',
    cookie: 'locale',
    extension: '.json',
    logDebugFn: function (msg) {
        console.log(msg);
    },
});

app.set('port', process.env.PORT || 3000);

// 设定模板引擎为swig
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', swig.renderFile);

app.use(express.compress());
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser({ uploadDir: './tmp' }));
app.use(express.cookieParser());
app.use(express.methodOverride());
app.use(i18n.init);

// 所有View中都会获得的参数包
app.locals.shared = {};
app.locals.shared.title = "TreeVisualizer";
app.locals.shared.year = new Date().getFullYear();

app.use(function (req, res, next) {
    if (!req.cookies || !req.cookies.locale) // 检查locale
        res.cookie("locale", "zh", { maxAge: 30 * 24 * 3600 * 1000 });

    res.locals.lang = req.getLocale() || "zh"; // 所有View中都会获得的动态参数包

    next();
});

app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

if ('development' == app.get('env')) {
    app.use(express.errorHandler());
    app.set('view cache', "false");

    // 禁用swig缓存
    swig.setDefaults({ cache: false });
}

/*
 * HTTP路由
 */
import routes = require('./routes/index');
app.get ('/lang/:locale', function (req, res, next) {
    res.cookie("locale", req.params.locale, { maxAge: 30 * 24 * 3600 * 1000 });
    res.redirect(req.header('Referer') || '/');
});
app.get ('/', routes.index);
app.get ('/trees/:id', routes.treeview);
app.post('/trees/new', routes.uploadtree);


// 将socket.io插入服务器
var server = http.createServer(app);
var io = socketio(server);

server.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

/*
 * Socket事件
 */
io.on('connection', function (socket) {
    socket.on('playtree', routes.playtree(socket));
    socket.on('showfinaltree', routes.showfinaltree(socket));
});