///<reference path="db.js" />

function UserDB() {

    this.search = function (name, callback) {
        this.executeSql("SELECT * FROM User WHERE name LIKE ?", ['%' + name + '%'], callback);
    }

    this.toString = function () {
        return JSON.stringify(this);
    }
}

//schema is not used (and is optional) if table already exists.
var schema = { id: 'integer primary key asc', name: 'text', birthDate: 'text', gender: 'text', phone: 'integer' };
//var cfg = { dbClass: UserDB, tableName: 'User', schema: schema, modelType: User };
var cfg = { dbClass: UserDB, tableName: 'user', modelType: User };
DBHelper.setup(cfg);

