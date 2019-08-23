const fs = require('fs');
const http = require('http');
const path = require('path');
const math = require('math');
const colors = require('colors');
const request = require('request');
const setCookie = require('set-cookie-parser');


var down_path = '';
var stage = 0;
var PARALLEL = 10;
var username, pass, loggedin = false;

var PAGES = 0, HEADERS;
UserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:68.0) Gecko/20100101 Firefox/68.0';

function input() {
    const input = document.getElementById('input');
    const out = document.querySelector('.output');
    const value = input.value;
    switch (stage) {
        case 0: // Speed
            if (value != '')
                PARALLEL = value;
            stage = 1;
            out.innerText =
                'Please select action:\n' +
                '6-digit-number: Download nhentai/g/xxxxxx\n' +
                `fav: Download account's favorite manga\n` +
                `file: Download from 'download.txt'\n` +
                `continue: Continue download(queue.txt)\n`;
            break;
        case 1: // Action
            if (value == 'fav') {
                stage = 2;
                out.innerText = 'Username or Email:';
            }else if (value == 'file') {
                stage = -1;
                fs.readFile(path.join(down_path, 'download.txt'), function (err, data) {
                    if (err) {
                        console.error(err);
                        stage = 1;
                        return;
                    }
                    var queue = data.toString().split('\n');
                    queue.pop();
                    argv(0, queue, true);
                });
            }else if (value == 'continue') {
                stage = -1;
                fs.readFile(path.join(down_path, 'queue.txt'), function (err, data) {
                    if (err) {
                        console.error(err);
                        stage = 1;
                        return;
                    }
                    var queue = data.toString().split('\n');
                    queue.pop();
                    argv(0, queue, true);
                });
            }else {
                argv(0, value.split(' '), true);
                stage = -1;
            }
            break;
        case 2:
            username = value;
            stage = 3;
            out.innerText = 'Password:';
            document.getElementById('input').type = 'password';
            break;
        case 3:
            pass = value;
            stage = 4;
            document.getElementById('input').type = 'text';
            hide('send', true);
            login(username, pass);
            break;
        case 4:
            var arr = value.split(' ');
            var start = Number(arr[0]);
            var end = Number(arr[1]);
            if (start <= end && end <= PAGES)
                download_page(start, end, HEADERS, true);
            stage = -1;
            break;
        case -1:
            out.innerText =
                'Please select action:\n' +
                '6-digit-number: Download nhentai/g/xxxxxx\n' +
                `fav: Download account's favorite manga\n` +
                `file: Download from 'download.txt'\n` +
                'continue: Continue download(queue.txt)\n';
            stage = 1;
    }
    input.value = '';
}
function hide(object, status) {
    if (status)
        document.getElementById(object).style.display = 'none';
    else
        document.getElementById(object).style.display = 'block';
}


http.globalAgent.maxSockets = Infinity;

async function exit_program() {
    hide('send', false);
    hide('progress', true); 
    document.querySelector('.output').innerText = 'Download complete!\nHit \'Enter\' to continue.';
    document.querySelector('.progress').innerText = '';
    document.getElementById('input').focus();
    stage = -1;
}


function download(val) {
    if (isNaN(val = val.substr(0, 6)))
        return;
    end = true;
    return new Promise((resolve, reject) => {
        request({url: `https://nhentai.net/g/${val}`}, async function(error, response, body) {
            if (error || response.statusCode !== 200) {
                console.log('Error: ' + val);
                fs.rmdir(path.join('.', val), function(err) {});
                resolve(0);
                return;
            }
            //get uri
            var keyword = '<meta itemprop=\"image\" content=\"https://t.nhentai.net/galleries/';
            var index = body.indexOf(keyword) + keyword.length;
            var uri = '', cnt = '', title = '';
            while (body[index] != '/')
                uri += body[index++];
            //get pages
            index = body.indexOf(' pages</div>');
            while (body[index - 1] != '>')
                index--;
            while (body[index] != ' ')
                cnt += body[index++];
            finish = cnt = parseInt(cnt, 10);
            //get title
            keyword = '<h2>';
            index = body.indexOf(keyword) + keyword.length;
            while (body[index] != '<' || body[index + 1] != '/' || body[index + 2] != 'h')
                title += body[index++];

            var dirname = replace_str(`${title}(${val})`);
            fs.mkdir(path.join(down_path, dirname), function(err) {});

            document.querySelector('.output').innerText = `${title} (${cnt}p) (${val})`;
            // console.log(`${title} (${cnt}p) (${val})`);

            await run(cnt, uri, val, dirname);
            resolve(0);
        });
    })
}
async function download_photo(uri, filename, callback, cnt) {
    if (cnt > 5) {
        callback();
        return;
    }
    if (cnt > 0)
        console.log('\n' + filename + '   Error: ' + cnt);

    request.head({url: uri + 'jpg'}, function(err, resp, body) {
        if (!err && resp.statusCode === 200)
            request({url: uri + 'jpg'}).on('error', function(err) {
                console.log(err);
                download_photo(uri, filename, callback, cnt + 1);
                return;
            }).pipe(fs.createWriteStream(filename + 'jpg')).on('close', callback);
        else
            request.head({url: uri + 'png'}, function(err, resp, body) {
                if (!err && resp.statusCode === 200) {
                    request({url: uri + 'png'}).on('error', function(err) {
                        console.log(err);
                        download_photo(uri, filename, callback, cnt + 1);
                        return;
                    }).pipe(fs.createWriteStream(filename + 'png')).on('close', callback);
                }else {
                    console.log(err);
                    download_photo(uri, filename, callback, cnt + 1);
                    return;
                }
                    
            });
     });
}
function run(cnt, uri, val, dir) {
    const wait = function () {
        return new Promise(async (resolve, reject) => {
            while (1) {
                if (downloading <= PARALLEL)
                    resolve(0);
                await sleep(50);
            }
        })
    }
    return new Promise(async (resolve, reject) => {
        tmp = 0;
        downloading = 0;
        const div = cnt;
        document.querySelector('.progress').innerText = '0%';
        while (cnt > 0) {
            await wait();
            downloading++;
            download_photo(`https://i.nhentai.net/galleries/${uri}/${cnt}.`, path.join(down_path, dir, cnt + '.'), async function() {
                await sleep(100);
                downloading--;

                document.querySelector('.progress').innerText = String(math.floor((1 - --finish / div) * 100)) + '%';
                if (finish <= 0) {
                    remove_first_line();
                    resolve(0);
                }
            }, 0);
            cnt--;
        }
    });
}
function remove_first_line() {
    var filename = path.join(down_path, 'queue.txt');
    fs.readFile(filename, 'utf8', function(err, data) {
        var linesExceptFirst = data.split('\n').slice(1).join('\n');
        if (linesExceptFirst == '')
            fs.unlinkSync(filename);
        else
            fs.writeFile(filename, linesExceptFirst, (err) => {
                if (err)
                    console.log(err);
            });
    });
}
async function argv(start, queue, exit_when_end, argc) {
    if (!argc) {
        var file = fs.createWriteStream(path.join(down_path, 'queue.txt'));
        file.on('error', function(err) {
            
        });
        queue.forEach(function(i) {
            file.write(i + '\n');
        });
        file.end();
    }
    return new Promise(async (resolve, reject) => {
        end = false;
        hide('send', true);
        hide('progress', false);
        document.querySelector('.output').innerText = '';
        for (var i = start; i < queue.length; i++)
            await download(queue[i]);
        hide('send', false);
        if (end && exit_when_end)
            exit_program();
        resolve(0);
    });       
}
async function logging_in_text() {
    var cnt = 1;
    while (!loggedin) {
        var str = 'Logging in';
        for (var i = cnt; i; i--)
            str += '.';
        if (cnt == 3)
            cnt = 1;
        else
            cnt++;
        if (!loggedin)
            document.querySelector('.output').innerText = str;
        else
            break;
        await sleep(200);
    }
}
async function login(username, pass) {
    // Login
    loggedin = false;
    logging_in_text();
    request.get({url: 'https://nhentai.net/login/', headers: {'User-Agent': UserAgent}}, async function(error, response, body) {
        var token = '';
        var keyword = 'name=\"csrfmiddlewaretoken\" value=\"';
        var index = body.indexOf(keyword) + keyword.length;
        while (body[index + 1] != '>')
            token += body[index++];
        var cookies = await setCookie.parse(response.headers['set-cookie'], {
            decodeValues: true,
            map: true
        });
        var cfduid = cookies.__cfduid.value;
        var options = {
            url: 'https://nhentai.net/login/',
            headers: {
                'Host': 'nhentai.net',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.5',
                'User-Agent': UserAgent,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://nhentai.net/login/',
                'DNT': '1',
                'Cookie': `__cfduid=${cfduid}; csrftoken=${cookies.csrftoken.value}`,
                'Connection': 'keep-alive'
            },
            form: {
                'csrfmiddlewaretoken': token,
                'username_or_email': username,
                'password': pass
            }
        }
        request.post(options, async function(error, response, body) {
            var cookies = setCookie.parse(response.headers['set-cookie'], {
                decodeValues: true,
                map: true
            });
            var headers = {
                'User-Agent': UserAgent,
                'Cookie': `__cfduid=${cfduid}; csrftoken=${cookies.csrftoken.value}; sessionid=${cookies.sessionid.value}`,
            };
            loggedin = true;
            request({
                url: 'https://nhentai.net/favorites/',
                headers: headers
            }, function(error, response, body) {
                // Get pages
                var pages = 0, mul = 1;
                keyword = '\" class=\"last\"><i class=';
                index = body.indexOf(keyword) - 1;
                while (body[index] != '=') {
                    pages += body[index--] * mul;
                    mul *= 10;
                }
                // select_page(pages, headers);
                PAGES = pages;
                HEADERS = headers;
                document.querySelector('.output').innerText = `Total pages: ${pages}\n` + 
                'Insert download page range: (ex. \"1 5\")';
                hide('send', false);
                document.getElementById('input').focus();
            });
        });
    })
}
function get_page_data(page, headers, queue_obj) {
    return new Promise(async (resolve, reject) => {
        request({
            url: `https://nhentai.net/favorites/?page=${page}`,
            headers: headers
        }, async function(error, response, body) {
            var index_pre = 0;
            var keyword = 'gallery-favorite\" data-id=\"';
            while (1) {
                var index = body.indexOf(keyword, index_pre);
                var val = '';
                if (index == -1) {
                    resolve(0);
                    break;
                }
                index += keyword.length;
                while (body[index] != '\"')
                    val += body[index++];
                queue_obj.queue.push(val);
                index_pre = index;
            }
        });
    });
}
function download_page(start, end, headers, save) {
    return new Promise(async (resolve, reject) => {
        var queue = [];
        for (; start <= end; start++) {
            await get_page_data(start, headers, {queue});
        }
        await argv(0, queue, false);
        resolve(0);
    });
}

function replace_str(str) {
    str = str.replace(/\//g, ' ');
    str = str.replace(/\\/g, ' ');
    str = str.replace(/:/g, ' ');
    str = str.replace(/\*/g, ' ');
    str = str.replace(/\"/g, ' ');
    str = str.replace(/</g, '(');
    str = str.replace(/>/g, ')');
    str = str.replace(/\|/g, ' ');
    str = str.replace(/\?/g, '？');
    return str;
}
function sleep(ms){
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}
