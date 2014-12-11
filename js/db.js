
(function (window, document, undefined) {
    'use strict';

    var db;
    var schemas = {};
    var queries = {};
    var isReady = false;

    window.DataBase = function () {
        var self = this;
        var queries = {};
        var isReady = false;
        var schema;
        this.executeSqlSingle = function (sql, parameters) {
            return DataBase.executeSql(sql, parameters).then(function (rs) { if (rs) return rs[0]; });
        }

        this.executeSql = function (sql, parameters) {
            return DataBase.executeSql(sql, parameters);
        }

        this.getAll = function () {
            return onReady().then(function () {
                return DataBase.executeSql(queries.selectAll);
            });
        }
        this.getById = function (id) {
            return onReady().then(function () {
                return self.executeSqlSingle(queries.selectById, [id]);
            });
        }

        this.deleteAll = function () {
            return onReady().then(function () {
                return DataBase.executeSql(queries.deleteAll);
            });
        }

        this.deleteById = function (id) {
            return onReady().then(function () {
                return DataBase.executeSql(queries.deleteById, [id]);
            });
        }

        this.insert = function (object) {
            return onReady().then(function () {

                var params = schema.columns.map(function (col) { return object[col.name] === undefined ? null : object[col.name]; });
                return DataBase.executeSql(queries.insert, params);
            });
        }

        this.update = function (object) {
            return onReady().then(function () {

                var params = schema.columns.filter(function (col) { return !col.isPrimaryKey }).concat(schema.columns.filter(function (col) { return col.isPrimaryKey }));
                params = params.map(function (col) { return object[col.name] === undefined ? null : object[col.name]; });
                return DataBase.executeSql(queries.update, params);
            });
        }


        function setReady() {
            isReady = true;
            schema = schemas[self.constructor.tableName];
            var columns = schema.columns.map(function (col) { return col.name; });

            DataBase.log('Generating SQL for:', self.constructor.name);
            queries.selectAll = 'SELECT * FROM ' + schema.tableName;
            queries.selectById = 'SELECT * FROM ' + schema.tableName + ' WHERE ' + schema.primaryKey + ' = ?';
            queries.deleteAll = 'DELETE FROM ' + schema.tableName;
            queries.deleteById = 'DELETE FROM ' + schema.tableName + ' WHERE ' + schema.primaryKey + ' = ?';

            var sql = "INSERT INTO " + schema.tableName + '(' + columns.join(', ') + ')';
            sql += ' VALUES(' + columns.map(function () { return '?' }).join(', ') + ')';
            queries.insert = sql;

            var sql = "UPDATE " + schema.tableName + ' SET ' + columns.filter(function (col) { return col != schema.primaryKey }).join(' = ?, ') + ' = ? ';
            sql += ' WHERE ' + schema.primaryKey + ' = ?';
            queries.update = sql;
        }

        function onReady() {
            var dbClass = self.constructor;
            var timeout = 0;

            if (dbClass.isReady)
                return Promise.resolve();

            return new Promise(function (resolve, reject) {

                var interval = setInterval(function () {
                    timeout += 50;

                    if (dbClass.isReady) {
                        clearInterval(interval);
                        resolve();
                    }
                    else if (timeout > 4000) {
                        clearInterval(interval);
                        reject('Timeout');
                    }
                }, 50);
            }).then(setReady);
        }
    }

    DataBase.executeSqlBatch = function (commands, okCallback, errorCallback) {
        commands = commands.filter(function (i) { return i && i.trim(); });

        if (!commands.length)
            return;

        var execute = function (tx, idx) {
            var cmd = commands[idx];
            tx.executeSql(cmd, null
                , function () {
                    DataBase.log('BatchExecuted', cmd);
                    if (idx == commands.length - 1) {
                        if (okCallback)
                            okCallback();
                    }
                    else
                        execute(tx, ++idx);
                }
                , function (tx, err) {
                    DataBase.log('BatchError', cmd, arguments);
                    if (errorCallback)
                        errorCallback(err, cmd);
                });
        }

        DataBase.db.transaction(function (tx) {
            execute(tx, 0);
        });
    }

    DataBase.executeSql = function (sql, parameters) {

        return new Promise(function (resolve, reject) {
            var fail = function (tx, err) { return reject(err) };

            var exec = function () {
                DataBase.log('Querying: ', sql, 'Parameters:', parameters || []);

                db.transaction(function (tx) {
                    tx.executeSql(sql, parameters, function (t, r) { resolve(r) }, fail);
                }, fail);
            }

            if (!DataBase.isReady)
                onReady().then(exec);
            else
                exec();
        }).then(translate);
    }

    DataBase.setup = function (childClass, tableName, tableSchema) {
        childClass.prototype = new DataBase;
        childClass.prototype.constructor = childClass;
        childClass.tableName = tableName;

        if (!isReady)
            return onReady().then(function () { DataBase.setup(childClass, tableName, tableSchema); });

        DataBase.log('Setting up:', childClass.name, tableName);
        if (tableSchema && !schemas[tableName]) {
            //CREATE TABLE
            schemas[tableName] = tableSchema;
            return createTable(tableSchema, tableName)
                .then(function () { return DataBase.executeSql('SELECT name, sql FROM sqlite_master WHERE type="table" AND name = ?', [tableName]) })
                .then(loadSchemas)
                .then(function () { return setReady(childClass, tableName) });
        }
        else if (!schemas[tableName]) {
            return DataBase.log('Table not found: ' + tableName);
        }
        else {
            return setReady(childClass, tableName);
        }
    }

    DataBase.init = function (dbObject) {
        db = dbObject;
        loadSchemas().then(function () {
            isReady = true;
            DataBase.log('DataBase is ready!');
        });
    }

    function loadSchemas(tables) {
        if (!tables) {
            return new Promise(function (resolve, reject) {
                db.transaction(function (tx) { tx.executeSql('SELECT name, sql FROM sqlite_master WHERE type="table";', [], function (tx, rs) { return resolve(loadSchemas(translate(rs))); }, reject) });

            });
        }

        for (var i = 0; i < tables.length; i++) {
            var table = tables[i];

            var schema = {};
            var columns = table.sql.replace(/^[^\(]+\(([^\)]+)\)/g, '$1').replace(/\`|\r|\n/g, '').split(',').map(function (i) { return i.trim() });
            var cols = [];
            var primaryKey;
            for (var c = 0; c < columns.length; c++) {
                var col = columns[c].trim();
                var colValues = col.split(' ');
                var name = colValues[0];
                var type = colValues[1] || '';

                var isPrimaryKey = col.indexOf('primary key') >= 0;
                if (isPrimaryKey) primaryKey = primaryKey || name;
                cols.push({ name: name, type: type, isPrimaryKey: isPrimaryKey });
            }

            schemas[table.name] = { tableName: table.name, columns: cols, primaryKey: primaryKey };
        }

        return Promise.resolve(schemas);
    }

    function translate(result) {
        var ret = [];
        for (var i = 0; i < result.rows.length; i++) {
            var row = result.rows.item(i);
            var obj = {};
            for (var p in row)
                obj[p] = row[p];
            ret.push(obj);
        }

        return ret;
    }

    function onReady() {
        var timeout = 0;

        return new Promise(function (resolve, reject) {
            if (isReady)
                return resolve();
            var interval = setInterval(function () {
                timeout += 50;

                if (isReady) {
                    clearInterval(interval);
                    resolve();
                }
                else if (timeout > 4000) {
                    clearInterval(interval);
                    reject('Timeout');
                }
            }, 50);
        });
    }

    function createTable(tableSchema, tableName) {
        var sql = 'CREATE TABLE IF NOT EXISTS ' + tableName + ' (';

        for (var prop in tableSchema)
            sql += prop + ' ' + tableSchema[prop] + ' , ';

        sql = sql.substr(0, sql.length - 2);
        sql += ')';

        return DataBase.executeSql(sql);
    }

    function setReady(childClass, tableName) {
        childClass.isReady = true;
        DataBase.log(childClass.name + ' is ready!');
        return Promise.resolve(true);
    }

    DataBase.log = function () {
        console.log([].slice.call(arguments));
    }
})(window, document, undefined);