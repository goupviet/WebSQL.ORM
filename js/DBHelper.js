(function (window, document, undefined) {
    'use strict';

    var db;
    var schemas = {};
    var isEngineReady = false;

    window.DBHelper = function () {
        var self, config;

        this.executeSqlSingle = function (sql, parameters, modelType) {
            return DBHelper.executeSql(sql, parameters, modelType).then(function (rs) { if (rs) return rs[0]; });
        }

        this.executeSql = function (sql, parameters, modelType) {
            return DBHelper.executeSql(sql, parameters, modelType);
        }

        this.getAll = function () {
            var $result = [];
            var promise = this.onReady().then(function () {
                return DBHelper.executeSql(config.queries.selectAll, [], self.constructor.dbConfig.modelType, $result);
            });
            promise.$result = $result;

            return promise;
        }
        this.getById = function (id) {
            return this.onReady().then(function () {
                return self.executeSqlSingle(config.queries.selectById, [id], self.constructor.dbConfig.modelType);
            });
        }

        this.deleteAll = function () {
            return this.onReady().then(function () {
                return DBHelper.executeSql(config.queries.deleteAll);
            });
        }

        this.deleteById = function (id) {
            return this.onReady().then(function () {
                return DBHelper.executeSql(config.queries.deleteById, [id]);
            });
        }

        this.insert = function (object) {
            return this.onReady().then(function () {

                var params = config.schema.columns.map(function (col) { return object[col.name] === undefined ? null : object[col.name]; });
                return DBHelper.executeSql(config.queries.insert, params);
            });
        }

        this.update = function (object) {
            return this.onReady().then(function () {

                var params = config.schema.columns.filter(function (col) { return !col.isPrimaryKey }).concat(config.schema.columns.filter(function (col) { return col.isPrimaryKey }));
                params = params.map(function (col) { return object[col.name] === undefined ? null : object[col.name]; });
                return DBHelper.executeSql(config.queries.update, params);
            });
        }

        function setReady(dbClass) {
            //console.log('setReady', dbClass.dbConfig);

            config = dbClass.dbConfig;
            var schema = config.schema;
            if (dbClass.dbConfig.queries)
                return;

            var queries = dbClass.dbConfig.queries = {};
            var columns = schema.columns.map(function (col) { return col.name; });
            DBHelper.log('Generating SQL for:', self.constructor.name);
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

        this.onReady = function () {
            //console.log('onready');
            var dbClass = this.constructor;
            self = this;

            if (dbClass.setupCompleted) {
                setReady(dbClass);
                dbClass.isReady = true;
                return Promise.resolve();
            }

            var timeout = 0;
            return new Promise(function (resolve, reject) {

                var interval = setInterval(function () {
                    timeout += 50;

                    if (dbClass.setupCompleted) {
                        clearInterval(interval);
                        dbClass.isReady = true;
                        setReady(dbClass);
                        resolve();
                    }
                    else if (timeout > 4000) {
                        clearInterval(interval);
                        reject('Timeout');
                    }
                }, 50);
            });
        }
    }

    DBHelper.executeSqlBatch = function (commands) {
        commands = commands.filter(function (i) { return i && i.trim(); });

        var promises = [];
        for (var i = 0; i < commands.length; i++)
            promises.push(DBHelper.executeSql(commands[i]));

        return Promise.all(promises);
    }

    DBHelper.executeSqlSingle = function (sql, parameters, dbClass) {
        return DBHelper.executeSql(sql, parameters, dbClass).then(function (rs) { if (rs) return rs[0]; });
    }

    DBHelper.executeSql = function (sql, parameters, modelType, $result) {
        $result = $result || [];

        if (sql.indexOf(';') >= 0 && sql.indexOf(';') < sql.length - 1) { //Multi statement query

            var idx = 0;
            var promise = null;
            var queries = sql.split(';').filter(function (q) { return q.replace(/\s/g, ''); });
            parameters.reverse();

            var exec = function () {
                var query = queries[idx];
                var params = [];
                var parameterCount = (query.match(/\?/g) || []).length;
                for (var i = 0; i < parameterCount; i++)
                    params.push(parameters.pop());
                DBHelper.log('Executing Multi Statement SQL(' + idx + '): ', query, 'Params (' + parameterCount + ')', params);
                idx++;

                return DBHelper.executeSql(query, params, modelType).then(function (v) {
                    if (idx == queries.length)
                        return v;

                    return exec();
                });
            };

            return exec();
        }

        var promise = new Promise(function (resolve, reject) {
            var fail = function (tx, err) { return reject(err) };

            var exec = function () {
                db.transaction(function (tx) {
                    tx.executeSql(sql, parameters, function (t, r) {
                        resolve(r)
                    }, fail);
                }, fail);
            }

            if (!isEngineReady)
                onEngineReady().then(exec);
            else
                exec();
        }).then(function (result) {
            translate(result, modelType, $result);
            if (parameters && parameters.length)
                DBHelper.log('Querying: ', sql, 'Parameters:', parameters || [], 'Result:', $result);
            else
                DBHelper.log('Querying: ', sql, 'Result:', $result);

            $result.$isReady = true;
            return $result;
        }).catch(function (err) {
            DBHelper.log('Error in Query:', sql, 'Parameters:', parameters || [], 'Error: ', err);
        });
        promise.$result = $result;
        return promise;
    }

    function translate(result, modelType, ret) {
        var modelType = modelType || Object;

        var ret = ret || [];
        for (var i = 0; i < result.rows.length; i++) {
            var row = result.rows.item(i);
            var obj = new modelType;
            for (var p in row)
                obj[p] = row[p];
            ret.push(obj);
        }

        return ret;
    }

    DBHelper.setup = function (config) {

        if (arguments[0].constructor == Function)
            config = { dbClass: arguments[0], tableName: arguments[1] };

        var dbClass = config.dbClass,
            tableName = config.tableName,
            tableSchema = config.tableSchema,
            modelType = config.modelType;

        dbClass.prototype = new DBHelper;
        dbClass.prototype.constructor = config.dbClass;
        dbClass.dbConfig = config;
        dbClass.dbConfig.tableName = tableName;
        dbClass.dbConfig.modelType = modelType || Object;

        function setReady(childClass, tableName, schema) {
            childClass.dbConfig.schema = schema;
            childClass.setupCompleted = true;
            DBHelper.log(childClass.name + ' is ready!');
        }

        if (!isEngineReady)
            return onEngineReady().then(function () { DBHelper.setup(config); });

        DBHelper.log(dbClass.name + ' is initializing...');
        if (tableSchema && !schemas[tableName]) {
            //CREATE TABLE
            schemas[tableName] = tableSchema;
            return createTable(tableSchema, tableName)
                .then(function () { return DBHelper.executeSql('SELECT name, sql FROM sqlite_master WHERE type="table" AND name = ?', [tableName]) })
                .then(loadSchemas)
                .then(function () { return setReady(dbClass, tableName, schemas[tableName]) });
        }
        else if (!schemas[tableName]) {
            DBHelper.log('Table not found: ' + tableName);
        }
        else {
            setReady(dbClass, tableName, schemas[tableName]);
        }
    }

    DBHelper.init = function (dbObject) {
        DBHelper.log('DBHelper is initializing...');
        db = dbObject;
        loadSchemas().then(function () {
            isEngineReady = true;
            DBHelper.log('DBHelper is ready!');
        });
    }

    function loadSchemas(tables) {
        if (!tables) {
            return new Promise(function (resolve, reject) {
                db.transaction(function (tx) { tx.executeSql('SELECT name, sql FROM sqlite_master WHERE type="table";', [], function (tx, rs) { return resolve(loadSchemas(translate(rs))); }, reject) });

            });
        }

        var constraints = ['primary', 'unique', 'check', 'foreign'];
        var ignoreConstraints = function (col) {
            col = col.toLowerCase();
            for (var i = 0; i < constraints.length; i++)
                if (col.indexOf(constraints[i]) == 0)
                    return false;

            return true;
        }

        for (var i = 0; i < tables.length; i++) {
            var table = tables[i];

            var _sql = table.sql;
            _sql = _sql.substr(_sql.indexOf('(') + 1, _sql.lastIndexOf(')') - _sql.indexOf('(') - 1); // Extrai colunas
            _sql = _sql.replace(/\`|\r|\n/g, ''); //Limpa caracteres

            var schema = {};
            var columns = _sql.split(',').map(function (i) { return i.replace(/^\s+|\s+$/g, '');/*trim*/ }).filter(ignoreConstraints);
            var cols = [];
            var primaryKey;
            for (var c = 0; c < columns.length; c++) {
                var col = columns[c].replace(/\s+/g, ' '); //remove espaços duplicados
                var colValues = col.split(' ');
                var name = colValues[0].replace(/\[|\]/g, '');
                var type = colValues[1] || '';

                var isPrimaryKey = col.indexOf('primary key') >= 0;
                if (isPrimaryKey) primaryKey = primaryKey || name;
                cols.push({ name: name, type: type, isPrimaryKey: isPrimaryKey });
            }

            schemas[table.name] = { tableName: table.name, columns: cols, primaryKey: primaryKey };
        }

        return Promise.resolve(schemas);
    }

    function onEngineReady() {
        var timeout = 0;

        return new Promise(function (resolve, reject) {
            if (isEngineReady)
                return resolve();

            var interval = setInterval(function () {
                timeout += 50;

                if (isEngineReady) {
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

        return DBHelper.executeSql(sql);
    }

    DBHelper.log = function () {
        console.log.apply(console, arguments);
    }
})(window, document, undefined);