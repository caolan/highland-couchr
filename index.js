var url = require('url'),
    follow = require('follow'),
    couchr = require('couchr'),
    _ = require('highland');


var methods = [
    'get',
    'post',
    'head',
    'put',
    'del',
    'copy'
];

var exports = module.exports = function (base) {
    var api = ['changes'].concat(methods).reduce(function (api, name) {
        api[name] = function (loc /* args... */) {
            var args = Array.prototype.slice.call(arguments);
            args[0] = url.resolve(base, loc);
            return exports[name].apply(this, args);
        };
        return api;
    }, {});
    api.url = base;
    return api;
};

methods.forEach(function (name) {
    exports[name] = _.curry(function (loc, q) {
        return _(function (push, next) {
            couchr[name](loc, q, function (err, res, req) {
                if (err) {
                    push(err);
                    push(null, _.nil);
                }
                else {
                    req.body = res;
                    push(null, req);
                    push(null, _.nil);
                }
            });
        });
    });
});

exports.changes = function (db, q) {
    q = q || {};
    if (!q.hasOwnProperty('since')) {
        q.since = 'now';
    }
    q.db = db;
    var feed = new follow.Feed(q);
    var input;
    var output = _(function (push, next) {
        input = feed.follow();
    });
    feed.on('change', function (change) {
        output.write(change);
    });
    feed.on('error', function (err) {
        output.write({__HighlandStreamError__: true, error: err});
    });
    var _pause = output.pause;
    output.pause = function () {
        if (input && !input.is_paused) {
            feed.pause();
        }
        return _pause.apply(this, arguments);
    };
    var _resume = output.resume;
    output.resume = function () {
        if (input && input.is_paused) {
            feed.resume();
        }
        return _resume.apply(this, arguments);
    };
    output.stop = function (callback) {
      if (callback) {
        feed.once('stop', callback);
      }
      return feed.stop();
    };
    return output;
};
