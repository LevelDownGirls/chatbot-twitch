var irc = require("irc");
var dateTime = require('node-datetime');
var Magic = require("mtgsdk-ts");
var watch = require('node-watch');
var fs = require('fs');
var path = require('path');
var stdin = process.openStdin();
var request = require('request');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// startup - write startup text
function startup() {
    consoleOutput("\n\n");
    consoleOutput("Console commands:");
    consoleOutput(" !chat       - toggles chat commands on or off");
    consoleOutput(" !flood[x]   - sets flood provention to x (default 1000)");
    consoleOutput(" !lastfollow - prints the last follower to chat (-q for console only)");
    consoleOutput(" !spoof      - Sends out whatever you want on the follow notifier");
    consoleOutput("Everything not starting with a '!' will be sent to chat");
    consoleOutput("\n\nDon't forget to start the notifier or the bot will crash!");
}

function whisper(text, name) {
    if (production) {
        bot.say(config.channels[0], "/w " + name + " " + text);
    } else {
        bot.say(config.channels[0], "/msg " + name + " " + text);
    }
}

// card posting
function cardDeets(res, details, from) {
    if (details) {
        whisper(res.name + " - " + res.manaCost, from);
        whisper(res.text, from);
        whisper("http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=" + res.multiverseid, from);
    } else {
        bot.say(config.channels[0], description + res.name + " - " + res.manaCost);
        bot.say(config.channels[0], "http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=" + res.multiverseid);
    }
}

function hasFlag(flag, flagList) {
    return (flagList.indexOf(flag) > -1);
}

// getCommand - understand input strings
function getCommand(string) {
    var spacePlace = string.indexOf(" ");
    var flags = "";
    if (spacePlace != -1) {
        var before = string.substring(0, spacePlace);
        var after = string.substring(spacePlace + 1);
        if (after.startsWith("-")) {
            // if text after flag, remove flag from text
            if (after.indexOf(" ") != -1) {
                flags = after.substring(0, after.indexOf(" "));
                after = after.substring(after.indexOf(" ") + 1);
            } else { //else remove text
                flags = after;
                after = "";
            }
            flags = flags.split(''); //seperate chars to array
            flags.shift(); //remove the -
        }
    } else {
        flags = [];
        var before = string;
        var after = "";
    }
    return {
        command: before,
        text: after,
        flags: flags
    };
}

//consoleOutput - send to console and browser
function consoleOutput(text, nochat, noconsole) {
    if (text.startsWith("/me")) {
        text = text.substring(4);
    }
    io.emit('chat message', text);
    console.log(text);
}

// check followers
function checkFollowers(first) {
    request(options, function(error, response, body) {
        followers = JSON.parse(body);
        var latest = followers["follows"][0]["user"]["display_name"];
        if (latest != latestFollower) {
            latestFollower = latest;
            if (!first) {
                newFollower(latest);
            }
        }
    });

    function callback() {

    }
}

function newFollower(name) {
    bot.say(config.channels[0], "/me " + name + " is now following LevelDownGirls");
    request
        .get("http://localhost:8888/?follow=" + name)
        .on('error', function(err) {
            console.log("Error sending follow notification for " + name + ". Did you start the notifier?");
        })
}

function consoleSay(inp, send) {
    if (inp.startsWith("!")) {
        var input = getCommand(inp);
        switch (input['command']) {
            case "!chat":
                chatMode = chatMode ? 0 : 1;
                var msg = "/me -- CHAT MODE IS " + (chatMode ? "ON" : "OFF") + " --";
                consoleOutput(msg);
                bot.say(config.channels[0], msg);
                break;
            case "!lastfollow":
                if (!hasFlag("q", input['flags']))
                    bot.say(config.channels[0], "\/me " + latestFollower + " is now following LevelDownGirls");
                consoleOutput(latestFollower + " is the latest follower");
                break;
            case "!spoof":
                consoleOutput("Spoofing " + input["text"]);
                newFollower(input["text"]);
                break;
            case "!help":
                startup();
                break;
            case "!flood":
                bot.activateFloodProtection(input["text"]);
                consoleOutput(" -- FLOOD PROTECTION SET TO " + input["text"] + " --");
                break;
            case "!quit":
                if (hasFlag("y", input["flags"]))
                    process.exit();
                quit = 1;
                consoleOutput("ARE YOU SURE YOU WANT TO QUIT? Y/N");
                break;
            default:
                consoleOutput("malformed command");
        }
    } else {
        if (quit) {
            if (inp == "y") {
                consoleOutput("Quitting");
                process.exit();
            } else {
                consoleOutput("Not quitting");
                quit = 0;
            }
        } else {
            //output to console
            bot.say(config.channels[0], inp);
        }
    }
}

app.use(express.static(__dirname + '/public'));

// config
var chatMode = 1;
var production = 0;
var quit = 0;
var path = "C:/Users/Princess Lexi-Lexi/Documents/Unp/";
var music = path + "unp_now_playing.txt";
var magic = path + "magic.txt";

console.log("\n -- LIVE ON " + (production ? "TWITCH" : "TEST") + "! --");

var config = require('./config.js');

var options = {
    url: 'https://api.twitch.tv/kraken/channels/leveldowngirls/follows?&limit=25&offset=0',
    headers: {
        'Client-ID': config['clientid']
    }
};

if (!production) {
    var config = {
        password: "",
        channels: ["#foo"],
        server: "127.0.0.1",
        botName: "LevelerBot",
        floodProtection: false
    };
}

//display console options
startup();

//init
var bot = new irc.Client(config.server, config.botName, {
    channels: config.channels,
    password: config.password,
    floodProtection: config.floodProtection
});

//verbose errors
bot.addListener('raw', function(message) {
    //   console.log(message);
});

//normal errors
bot.addListener('error', function(message) {
    console.log('error: ', message);

});

// Listen for any message said to them in the room
bot.addListener("message", function(from, to, text, message) {
    if (chatMode) {
        if (text.startsWith("!")) {
            var input = getCommand(text);
            switch(input['command']){
                case "!time":
                    var dt = dateTime.create();
                    var formatted = dt.format('w I:M:S p');
                    bot.say(config.channels[0], "It is " + formatted + " for the LevelDown Girls (AEST)");
                    break;
                case "!help":
                    whisper("Hi! I am LevelerBot - a bot made by Lexi!", from);
                    whisper("I'm still under development but i hope you find me useful!", from);
                    whisper("I display card info, mention when theres a new follower, and tell you what music is playing", from);
                    whisper("My commands are:", from);
                    whisper("  !time - tells you what time it is for the LevelDown Girls", from);
                    whisper("  !Card [card name] - gives you info and a gatherer link", from);
                    whisper("If you have any suggestions for things i could learn to do, please tell lexi", from);
                    break;
                case "!card":
                    Magic.Cards.where({
                        name: input['text']
                    }).then(results => {
                        cardDeets(results[0], 1, from);
                    });
                    break;
            }
            // SAY MY NAME
            if (text.indexOf(config.botName) !== -1) {
                whisper("Hi there, " + from + ". Type !help for help.", from);
            }
        }
    }
});

// say the playing track in chat
watch(music, function(filename) {
    fs.readFile(music, 'utf8', function(err, data) {
        if (err) {
            return console.log(err);
        }
        bot.say(config.channels[0], "Now listening to: " + data);
    });
});

// Post the card reader card
watch(magic, function(filename) {
    fs.readFile(magic, 'utf8', function(err, data) {
        if (err) {
            return console.log(err);
        }
        Magic.Cards.find(data).then(result => cardDeets(result, 0, "Card: "));
    });

});

// Type into console.
stdin.addListener("data", function(d) {
    var inp = d.toString().trim();
    consoleSay(inp);
});

var latestFollower = "";

checkFollowers(1);
setInterval(function() {
    checkFollowers(0)
}, 60 * 1000);

// save follower info to a file to call back from OBS viewer thing

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');

});

io.on('connection', function(socket) {
    consoleSay("!help");
    socket.on('chat message', function(msg) {
        var mess = {
            msg: msg,
            client: 1
        };
        io.emit('chat message', mess);
        consoleSay(msg, 1);
    });
});

http.listen(8080, function() {
    console.log('listening on *:8080');
});


