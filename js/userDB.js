///<reference path="db.js" />

function UserDB() {

    this.search = function (name, callback) {
        this.executeSql("SELECT * FROM User WHERE name LIKE ?", ['%' + name + '%'], callback);
    }

    this.toString = function () {
        return JSON.stringify(this);
    }
}
function User() {
    this.yell = function () {
        DBHelper.log('My name is ' + this.name);
    }
}


var cfg = { childClass: UserDB, tableName: 'User', schema: { id: 'integer primary key asc', name: 'text', birthDate: 'text', gender: 'text', phone: 'integer' }, modelType: User };
DBHelper.setup(cfg);
//DBHelper.setup(UserDB, 'User'); //Table already exists
