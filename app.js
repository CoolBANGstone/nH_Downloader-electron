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
var username, pass, load_complete = false;

var PAGES = 0, HEADERS, TAGS;
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
                `continue: Continue download(queue.txt)\n` +
                'tag: Download manga by tag';
            break;
        case 1: // Action
            if (value == 'fav') {
                stage = 4;
                login();
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
            }else if (value === 'tag') {
                stage = 5;
                out.innerText = 'Please input tag';
            }else {
                argv(0, value.split(' '), true);
                stage = -1;
            }
            break;
        
        // Login type changed.
        //
        // case 2:
        //     username = value;
        //     stage = 3;
        //     out.innerText = 'Password:';
        //     document.getElementById('input').type = 'password';
        //     break;
        // case 3:
        //     pass = value;
        //     stage = 4;
        //     document.getElementById('input').type = 'text';
        //     hide('send', true);
        //     login(username, pass);
        //     break;
        case 4:
            var arr = value.split(' ');
            var start = Number(arr[0]);
            var end = Number(arr[1]);
            if (start <= end && end <= PAGES) {
                download_page(start, end, HEADERS, 'https://nhentai.net/favorites/');
                stage = -1;
            }
            break;
        case 5: // tag
            get_tag(TAGS = value.replace(' ', '-'));
            break;
        case 6:
            var arr = value.split(' ');
            var start = Number(arr[0]);
            var end = Number(arr[1]);
            if (start <= end && end <= PAGES) {
                download_page(start, end, HEADERS, `https://nhentai.net/tag/${TAGS}/`);
                stage = -1;
            }
            break;
        case -1:
            out.innerText =
                'Please select action:\n' +
                '6-digit-number: Download nhentai/g/xxxxxx\n' +
                `fav: Download account's favorite manga\n` +
                `file: Download from 'download.txt'\n` +
                'continue: Continue download(queue.txt)\n' + 
                'tag: Download manga by tag';
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
            keyword = '<span class=\"name\">';
            index = body.indexOf(keyword, body.indexOf('Pages:')) + keyword.length;
            while (body[index] != '<')
                cnt += body[index++];
            finish = cnt = parseInt(cnt, 10);
            //get title
            keyword = '<span class=\"pretty\">';
            index = body.indexOf(keyword) + keyword.length;
            while (body[index] != '<' || body[index + 1] != '/' || body[index + 2] != 's')
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
        hide('send', true);
        hide('progress', false);
        document.querySelector('.output').innerText = '';
        for (var i = start; i < queue.length; i++)
            await download(queue[i]);
        hide('send', false);
        if (exit_when_end)
            exit_program();
        resolve(0);
    });       
}
async function loading(text) {
    var cnt = 1;
    while (!load_complete) {
        var str = text;
        for (var i = cnt; i; i--)
            str += '.';
        if (cnt == 3)
            cnt = 1;
        else
            cnt++;
        if (!load_complete)
            document.querySelector('.output').innerText = str;
        else
            break;
        await sleep(200);
    }
}
async function get_tag(tag) {
    load_complete = false;
    loading('Loading');
    request({url: 'https://nhentai.net/tag/' + tag}, function(err, resp, body) {
        load_complete = true;
        if (err || resp.statusCode !== 200) {
            document.querySelector('.output').innerText = 'Fetch error!\nPlease input tag again:';
            stage = 5;
            return;
        }
        var pages = 0, mul = 1;
        keyword = '\" class=\"last\"><i class=';
        index = body.indexOf(keyword) - 1;
        if (index > 0) {
            while (body[index] != '=') {
                pages += body[index--] * mul;
                mul *= 10;
            }
            PAGES = pages;
        }else
            PAGES = pages = 1;
        document.querySelector('.output').innerText = `${tag}\nTotal pages: ${pages}\n` + 
        'Insert download page range: (ex. \"1 5\")';
        stage = 6;
    })
}
async function login() {
    // Login
    load_complete = false;
    loading('Logging in');
    fs.readFile(path.join(down_path, 'cookies.json'), (err, data) => {
        load_complete = true;
        if (err) {
            stage = -1;
            document.querySelector('.output').innerText = "Wrong session cookies! Press Cmd/Ctrl+L to open login window.";
            return;
        }
        var headers = {
            'User-Agent': UserAgent,
            'Cookie': data,
        };
        request({
            url: 'https://nhentai.net/favorites/',
            headers: headers
        }, function(error, response, body) {

            // Check if login success
            var keyword = '<title>';
            var title = '';
            index = body.indexOf(keyword) + keyword.length;
            while (body[index] !== '<') {
                title += body[index++];
            }
            if (title.indexOf('Login') !== -1) {
                stage = -1;
                document.querySelector('.output').innerText = "Wrong session cookies! Press Cmd/Ctrl+L to open login window.";
                return;
            }

            // Get pages
            var pages = 0, mul = 1;
            keyword = '\" class=\"last\"><i class=';
            index = body.indexOf(keyword) - 1;
            if (index > 0) {
                while (body[index] != '=') {
                    pages += body[index--] * mul;
                    mul *= 10;
                }
                // select_page(pages, headers);
                PAGES = pages;
            }else
                PAGES = pages = 1;
            HEADERS = headers;
            document.querySelector('.output').innerText = `Total pages: ${pages}\n` + 
            'Insert download page range: (ex. \"1 5\")';
            hide('send', false);
            document.getElementById('input').focus();
        });
    });
}
function get_page_data(page, headers, queue_obj, url) {
    return new Promise(async (resolve, reject) => {
        request({
            url: url + `?page=${page}`,
            headers: headers
        }, async function(error, response, body) {
            var index_pre = 0;
            var keyword = '/g/';
            while (1) {
                var index = body.indexOf(keyword, index_pre);
                var val = '';
                if (index == -1) {
                    resolve(0);
                    break;
                }
                index += keyword.length;
                while (body[index] != '/')
                    val += body[index++];
                queue_obj.queue.push(val);
                index_pre = index;
            }
        });
    });
}
function download_page(start, end, headers, url) {
    hide('send', true);
    return new Promise(async (resolve, reject) => {
        var queue = [];
        for (; start <= end; start++) {
            await get_page_data(start, headers, {queue}, url);
        }
        await argv(0, queue, true);
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
