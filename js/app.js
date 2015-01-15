///<reference path="db.js" />
///<reference path="userDB.js" />

var _db = openDatabase('MyDB', '1.0', 'My DBHelper', 10 * 1024 * 1024);

DBHelper.init(_db)

function log(type, p) {
    return function (value) {
        DBHelper.log.apply(null, [type, value]);
        return value;
    }
}

function insert(id, name, birthDate, gender, phone) {
    return userDB.insert({ id: id, name: name, birthDate: birthDate, gender: gender, phone: phone });
}

function insertMany() {
    var inserts = [];
    for (var i = 0; i < 10 ; i++)
        inserts.push(insert(10 + i, 'Name ' + i));

    return Promise.all(inserts);
}

var userDB = new UserDB();

userDB.deleteAll()
    .then(function () { return userDB.getAll() }).then(log('Empty'))
    .then(function () { return userDB.insert({ id: 1, name: "Jonny", birthDate: "2001-05-09", gender: "Male", phone: "555-1234" }) })
    .then(function () { return userDB.getAll() }).then(log('Jonny alone:'))
    .then(function () { return userDB.getById(1) }).then(function (jonny) { jonny.name = 'Not Jonny'; return userDB.update(jonny); })
    .then(function () { return userDB.getAll() }).then(log('Jonny not Jonny anymore:'))
    .then(insertMany)
    .then(function () { return userDB.getAll() })
    .then(log('All:')).catch(log('Error'))
    .then(function () { return userDB.getById(1) }).then(function (jonny) { jonny.yell() }).catch(log('Error'));//jonny is a User model