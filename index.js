var Github = require('github-api'),
    hat = require('hat'),
    queue = require('queue-async');

module.exports = Hubdb;

/**
 * Create a new Hubdb instance. This is a database-like wrapper for a
 * branch of a GitHub repository that treats JSON objects in that branch
 * as documents.
 * @param {Object} options
 * @param {string} options.username the user's name of the repository.
 * this is not necessary the user that's logged in.
 * @param {string} options.repo the repository name
 * @param {string} options.branch the branch of the repository to use as a
 * database.
 * @param {string} options.token a GitHub token. You'll need to get this
 * by OAuth'ing into GitHub or use an applicaton token.
 * @example
 * var db = Hubdb({
 *  token: 'MY_TOKEN',
 *  user: 'mapbox',
 *  repo: 'hubdb',
 *  branch: 'db'
 * });
 * db.add({ grass: 'green', function() {
 *   db.list(function(err, res) {
 *     // [{
 *     //   path: '2e959f35c6022428943b9c96d974498d.json'
 *     //   data: { grass: 'green' }
 *     // }]
 *   });
 * });
 */
function Hubdb(options) {

    var github = new Github({
      token: options.token,
      auth: "oauth"
    });

    var repo = github.getRepo(options.username, options.repo);

    /**
     * List documents within this database. If successful, the given
     * callback is called with an array of documents as
     * `{ path: string, data: object }` objects.
     * @param {Function} callback
     */
    function list(callback) {
        repo.getTree(options.branch, function(err, tree) {
            var q = queue(1);
            tree.filter(function(item) {
                return item.path.match(/json$/);
            }).forEach(function(item) {
                q.defer(function(cb) {
                    repo.read(options.branch, item.path + '?ref=' + options.branch, function(err, res) {
                        if (err) return cb(err);
                        return cb(null, { path: item.path, data: JSON.parse(res) });
                    });
                });
            });
            q.awaitAll(function(err, res) {
                if (err) return callback(err);
                return callback(null, res);
            });
        });
    }

    /**
     * Add a new object to the database. If successful, the callback is called
     * with (err, res) in which `res` reveals the id internally chosen
     * for this new item.
     *
     * @param {Object} data
     * @param {Function} callback
     */
    function add(data, callback) {
        var id = hat() + '.json';
        repo.write(options.branch, id, JSON.stringify(data), '+',
            function(err, res) {
                callback(err, res);
        });
    }

    function remove(id, callback) {
        repo.remove(options.branch, id + '?ref=' + options.branch,
            function(err, res) {
                callback(err, res);
        });
    }


    /**
     * Update an object in the database, given its id, new data, and a callback.
     *
     * @param {String} id
     * @param {Object} data
     * @param {Function} callback
     */
    function update(id, data, callback) {
        repo.write(options.branch, id, JSON.stringify(data), '+',
            function(err, res) {
                callback(err, res);
        });
    }

    return {
        list: list,
        update: update,
        // remove: remove,
        add: add
    };
}
