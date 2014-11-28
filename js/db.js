function DataBase() {

    this._getTableName = function () {
        return this.constructor.tableName;
    }
    this._getPrimaryKey = function () {
        return this.constructor.primaryKey;
    }
    this._getTableSchema = function () {
        return this.constructor.tableSchema;
    }

    this.executeSqlSingle = function (command) {
        //DataBase.log('executeSqlSingle', command);
        var args = [];
        var flag = false;
        for (var i = 0; i < arguments.length; i++) {
            if (!flag && arguments[i] && arguments[i].constructor == Function) {
                flag = true;
                var callback = arguments[i];
                args[i] = function (list) { callback(list[0]); };
            }
            else
                args[i] = arguments[i];
        }

        this.executeSql.apply(this, args);
    }

    this.executeSql = function (command) {
        //DataBase.log('executeSql', command);
        DataBase.executeSql.apply(null, arguments);
    }
}

DataBase.executeSqlBatch = function (commands, okCallback, errorCallback) {
    commands = commands.filter(function (i) { return i && i.trim(); });

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

DataBase.executeSql = function (command) {
    if (!DataBase.isReady)
        return DataBase.onReady(arguments);

    var parameters, okCB, errorCB;

    if (arguments.length == 1) {
        //no parameters
    }
    if (arguments[1] != null && arguments[1].constructor == Function) {
        okCB = arguments[1];
        errorCB = arguments[2];
    }
    else if (arguments[1] == null || arguments[1].constructor == Array) {
        parameters = arguments[1];
        okCB = arguments[2];
        errorCB = arguments[3];
    }
    else {
        throw new Error('Parameters not supported.');
    }

    if (parameters)
        DataBase.log('Querying: ', command, 'Parameters:', parameters);
    else
        DataBase.log('Querying: ', command);

    DataBase.db.transaction(function (tx) {
        tx.executeSql(command, parameters, DataBase.translateCallback(okCB), errorCB);
    }, function (err) { DataBase.log('Error querying database', command, parameters || '') });
}

DataBase.log = function () {
    console.log.apply(console, arguments);
}

DataBase.translateCallback = function (callback) {
    if (!callback)
        return null;

    return function (transaction, result) {
        var ret = [];
        for (var i = 0; i < result.rows.length; i++) {
            var row = result.rows.item(i);
            var obj = {};
            for (var p in row)
                obj[p] = row[p];
            ret.push(obj);
        }

        callback(ret);
    }
}

DataBase.prototype.onReady = function (callback) {
    var self = this;

    if (callback.callee) //Is Arguments
    {
        var args = callback;
        callback = function () { args.callee.apply(self, args); };
    }


    if (self.constructor.isReady)
        callback();
    else
        setTimeout(function () { self.onReady(callback); }, 1);
}

DataBase.prototype.isReady = function () {
    return !!this.constructor.isReady
}

DataBase.prototype.getAll = function (okCB, errorCB) {
    if (!this.isReady())
        return this.onReady(arguments);

    if (!this._getTableName())
        throw new Error('TableName not defined');

    var sql = this.constructor._SELECTALL = (this.constructor._SELECTALL || 'SELECT * FROM ' + this._getTableName());
    this.executeSql(sql, okCB, errorCB);
}

DataBase.prototype.getById = function (id, okCB, errorCB) {
    if (!this.isReady())
        return this.onReady(arguments);

    okCB = okCB || function () { };
    if (!this._getTableName()) throw new Error('TableName not defined');
    if (!this._getPrimaryKey()) throw new Error('PrimaryKey not defined');

    var sql = this.constructor._SELECTBYID = (this.constructor._SELECTBYID || 'SELECT * FROM ' + this._getTableName() + ' WHERE ' + this._getPrimaryKey() + ' = ?');
    this.executeSql(sql, [id], function (rs) { okCB(rs[0]); }, errorCB);
}

DataBase.prototype.deleteAll = function (okCB, errorCB) {
    if (!this.isReady())
        return this.onReady(arguments);

    if (!this._getTableName())
        throw new Error('TableName not defined');

    var sql = this.constructor._DELETEALL = (this.constructor._DELETEALL || 'DELETE FROM ' + this._getTableName());
    this.executeSql(sql, okCB, errorCB);
}

DataBase.prototype.deleteById = function (id, okCB, errorCB) {
    if (!this.isReady())
        return this.onReady(arguments);

    okCB = okCB || function () { };
    if (!this._getTableName()) throw new Error('TableName not defined');
    if (!this._getPrimaryKey()) throw new Error('PrimaryKey not defined');

    var sql = this.constructor._DELETEBYID = (this.constructor._DELETEBYID || 'DELETE FROM ' + this._getTableName() + ' WHERE ' + this._getPrimaryKey() + ' = ?');
    this.executeSql(sql, [id], okCB, errorCB);
}


DataBase.prototype.insert = function (object, okCB, errorCB) {
    if (!this.isReady())
        return this.onReady(arguments);

    if (!this._getTableName()) throw new Error('TableName not defined');
    if (!this._getPrimaryKey()) throw new Error('PrimaryKey not defined');
    var tableSchema = this._getTableSchema();

    var sql = this.constructor._INSERT;
    if (!sql) {
        var sql = "INSERT INTO " + this._getTableName() + '(';

        var values = ' VALUES(';
        for (var prop in tableSchema) {
            if (prop == this._getPrimaryKey())
                continue;

            sql += prop + ', ';
            values += '?, ';
        }

        sql = sql.substr(0, sql.length - 2);
        sql += ')';
        sql += values.substr(0, values.length - 2);
        sql += ')';

        this.constructor._INSERT = sql;
    }

    var parameters = [];
    for (var prop in tableSchema)
        if (prop != this._getPrimaryKey())
            parameters.push(object[prop] === undefined ? null : object[prop]);

    this.executeSql(sql, parameters, okCB, errorCB);
}


DataBase.prototype.update = function (object, okCB, errorCB) {
    if (!this.isReady())
        return this.onReady(arguments);

    if (!this._getTableName()) throw new Error('TableName not defined');
    if (!this._getPrimaryKey()) throw new Error('PrimaryKey not defined');
    var tableSchema = this._getTableSchema();

    var sql = this.constructor._UPDATE;
    if (!sql) {
        var sql = "UPDATE " + this._getTableName() + ' SET ';

        var values = ' VALUES(';
        for (var prop in tableSchema) {
            if (prop == this._getPrimaryKey())
                continue;

            sql += prop + ' = ?, ';
        }

        sql = sql.substr(0, sql.length - 2);
        sql += ' WHERE ' + this._getPrimaryKey() + ' = ?';
        this.constructor._UPDATE = sql;
    }

    var parameters = [];
    for (var prop in tableSchema)
        if (prop != this._getPrimaryKey())
            parameters.push(object[prop] === undefined ? null : object[prop]);

    parameters.push(object[this._getPrimaryKey()]);
    this.executeSql(sql, parameters, okCB, errorCB);
}

//CREATE TABLE IF NOT EXISTS Usuario (id integer primary key asc, nome text, idade integer)
DataBase.setup = function (childClass, tableName, tableSchema) {
    childClass.prototype = new DataBase;
    childClass.prototype.constructor = childClass;
    childClass.tableName = tableName;

    if (!DataBase.isReady)
        return DataBase.onReady(function () { DataBase.setup(childClass, tableName, tableSchema); });

    if (!tableSchema) {
        return DataBase.getTableSchema(tableName, function (schema) {
            if (!schema)
                return DataBase.log('Table not found: ' + tableName);

            childClass.tableSchema = schema;
            for (var prop in schema)
                if (schema[prop].toLowerCase().indexOf('primary key') > 0)
                    childClass.primaryKey = prop;
            childClass.isReady = true;
        });
    }

    childClass.tableSchema = tableSchema;

    var sql = 'CREATE TABLE IF NOT EXISTS ' + tableName + ' (';

    for (var prop in tableSchema) {
        sql += prop + ' ' + tableSchema[prop] + ' , ';
        if (tableSchema[prop].toLowerCase().indexOf('primary key') > 0)
            childClass.primaryKey = prop;
    }

    sql = sql.substr(0, sql.length - 2);
    sql += ')';

    DataBase.log('CREATE TABLE: ', sql);
    DataBase.db.transaction(function (tx) {
        tx.executeSql(sql, [], null, function (err) { DataBase.log('Error creating table: ' + childClass.name, arguments) });
        childClass.isReady = true;
    });
}

DataBase.readyCallbacks = [];
DataBase.init = function (db) {
    DataBase.db = db;
    DataBase.isReady = true;
    for (var i = 0; i < DataBase.readyCallbacks.length; i++)
        DataBase.readyCallbacks[i]();
}

DataBase.onReady = function (callback) {

    if (callback.callee) //Is Arguments
    {
        var args = callback;
        callback = function () { args.callee.apply(self, args); };
    }


    if (DataBase.isReady)
        callback();

    DataBase.readyCallbacks.push(callback);
}

DataBase.getTableSchema = function (tableName, callback) {
    DataBase.db.transaction(function (tx) {
        tx.executeSql('SELECT name, sql FROM sqlite_master WHERE type="table" AND name = ?;', [tableName], function (tx, results) {
            if (!results.rows.length)
                return callback(null);

            var schema = {};
            var columns = results.rows.item(0).sql.replace(/^[^\(]+\(([^\)]+)\)/g, '$1').replace(/\`|\r|\n/g, '').split(',').map(function (i) { return i.trim() });
            for (var i = 0; i < columns.length; i++) {
                var col = columns[i].trim();
                var colValues = col.split(' ');
                var name = colValues[0];
                var type = colValues[1] || '';

                schema[name] = type;
            }
            callback(schema);
        });
    });
}