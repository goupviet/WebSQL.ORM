Function.prototype.toPromisable = function () {
    var params = this.getParameters();

    if (params.indexOf('success') < 0 || params.indexOf('fail') < 0)
        throw new Error('Function not supported');

    var coreFn = this;

    return function () {
        var args = [].slice.apply(arguments);

        return new Promise(function (fullfill, reject) {

            var coreSuccess, coreFail;
            var success = function (result) {
                if (coreSuccess)
                    coreSuccess(result)
                fullfill(result);
            }
            var fail = function (error) {
                if (coreFail)
                    coreFail(error);
                reject(error);
            }

            for (var i = 0; i < params.length; i++) {
                if (params[i] == 'success') {

                    coreSuccess = args[i];
                    args[i] = success;
                }
                else if (params[i] == 'fail') {
                    coreFail = args[i];
                    args[i] = fail;
                }
            }

            coreFn.apply(this, args);
        });
    }
}

Function.prototype.getParameters = function () {
    var fn = this;
    var fstr = fn.toString();
    return fstr.match(/\(.*?\)/)[0].replace(/[()]/gi, '').replace(/\s/gi, '').split(',').filter(function (i) { return i.length; });
}
