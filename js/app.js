///<reference path="db.js" />
///<reference path="userDB.js" />

var _db = openDatabase('MyDB', '1.0', 'My DataBase', 10 * 1024 * 1024);

DataBase.init(_db)

function log(type, p) {
    return function () {
        DataBase.log(type, arguments[0]);
        return arguments[0];
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
    .then(userDB.getAll).then(log('Empty'))
    .then(userDB.insert({ id: 1, name: "John", birthDate: "2001-05-09", gender: "Male", phone: "555-1234" }))
    .then(userDB.getAll).then(log('User John only:'))
    .then(function () { return userDB.getById(1) }).then(function (john) { john.name = 'Not John'; return userDB.update(john); })
    .then(userDB.getAll).then(log('Not User John only:'))
    .then(insertMany)
    .then(userDB.getAll)
    .then(log('All:')).catch(log('Error'));

