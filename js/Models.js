
function User() {
    this.yell = function () {
        DBHelper.log('My name is ' + this.name);
    }
}
