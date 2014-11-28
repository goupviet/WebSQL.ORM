///<reference path="db.js" />

function UserDB() {

    this.search = function (name, callback) {
        this.executeSql("SELECT * FROM User WHERE name LIKE ?", ['%' + name + '%'], callback);
    }
}

DataBase.setup(UserDB, 'User', { id: 'integer primary key asc', name: 'text', birthDate: 'text', gender: 'text', phone: 'integer' });
//DataBase.setup(UserDB, 'User'); //Table already exists
