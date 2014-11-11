///<reference path="db.js" />
///<reference path="userDB.js" />

var _db = openDatabase('MyDB', '1.0', 'My DataBase', 10 * 1024 * 1024);

DataBase.init(_db)
var userDB = new UserDB();

function log(type) {
    return function () {
        DataBase.log(type, arguments[0]);
    }
}

userDB.getAll(log('getAll'));
userDB.query('SELECT * FROM User where Id == 1', log('query'));
userDB.search('john', log('search'))


userDB.insert({ name: 'to be deleted' }, function () {
    userDB.getAll(function (result) {

        var toBeDeleted = result[result.length - 1];
        toBeDeleted.name = 'to be deleted2';

        userDB.update(toBeDeleted, function () {

            userDB.getById(toBeDeleted.id, function (obj) {

                if (obj.name != 'to be deleted2')
                    DataBase.log('Update Not Working');

                log('ToBeDeleted')(toBeDeleted);
                userDB.deleteById(toBeDeleted.id);
            });
        });
    });
});