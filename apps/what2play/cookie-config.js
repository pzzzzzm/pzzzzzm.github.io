function setCookie(cname, cvalue, expire_days) {
    const d = new Date();
    d.setTime(d.getTime() + (expire_days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toGMTString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname) {
    const name = cname + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        const c = ca[i].trim();
        if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
    }
    return "";
}

function cleanCookie() {
    document.cookie = "";
}

function array2str(glist) {
    let s = "";
    if (glist.length !== 0) {
        for (let g of glist) {
            s += g;
            s += ",";
        }
        s = s.substring(0, s.length-1)
    }
    return s;
}

function str2array(s) {
    return s.split(",")
}

