var irc = require("irc");
var dateTime = require('node-datetime');
var Magic = require("mtgsdk-ts");
var watch = require('node-watch');
var fs = require('fs');
var path = require('path');
var stdin = process.openStdin();
var request = require('request');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);



// config
var chatMode = 1;
var production = 0;
console.log("\n -- LIVE ON "+(production ? "TWITCH" : "TEST")+"! --");

if(production){
    var config = require('./config.js');
}else{
    var config = {
        password: "",
        channels: ["#foo"],
        server: "127.0.0.1",
        botName: "LevelerBot",
        floodProtection: false
    };
}

//startup text
function startup(){
    consoleOutput("\n\n");
    consoleOutput("Console commands:");
    consoleOutput(" !chat       - toggles chat commands on or off");
    consoleOutput(" !flood[x]   - sets flood provention to x (default 1000)");
    consoleOutput(" !lastfollow - prints the last follower to chat (-q for console only)");
    consoleOutput(" !spoof      - Sends out whatever you want on the follow notifier");
    consoleOutput("Everything not starting with a '!' will be sent to chat");
    consoleOutput("\n\nDon't forget to start the notifier or the bot will crash!");
}

//display console options
startup();

//init
var bot = new irc.Client(config.server, config.botName, {
    channels: config.channels, password:config.password, floodProtection: config.floodProtection
});

//verbose errors
bot.addListener('raw', function(message) {
    //   console.log(message);
});

//normal errors
bot.addListener('error', function(message) {
    console.log('error: ', message);

});

function whisper(text,name){
    if(production){
        bot.say(config.channels[0], "/w "+name+" "+text);
    }else{
        bot.say(config.channels[0], "/msg "+name+" "+text);
    }
}
// Listen for any message said to them in the room
bot.addListener("message", function(from, to, text, message) {
    if(chatMode){
        if(text.toLowerCase().startsWith("!time")){
            var dt = dateTime.create();
            var formatted = dt.format('w I:M:S p');
            bot.say(config.channels[0], "It is "+formatted+" for the LevelDown Girls (AEST)");
        }
        if(text.toLowerCase().startsWith("!help")){
            whisper("Hi! I am LevelerBot - a bot made by Lexi!",from);
            whisper("I'm still under development but i hope you find me useful!",from);
            whisper("I display card info, mention when theres a new follower, and tell you what music is playing",from);
            whisper("My commands are:",from);
            whisper("  !time - tells you what time it is for the LevelDown Girls",from);
            whisper("  !Card [card name] - gives you info and a gatherer link",from);
            whisper("If you have any suggestions for things i could learn to do, please tell lexi",from);
            bot.say(config.channels[0], "/w "+from+" \n\n\n\n \n \n ");
        }
        if(text.toLowerCase().startsWith("!card ")){
            var query = text.toLowerCase().substring(9); //remove command
            query = query.replace(/^\s+|\s+$/g, ""); //trim whitespace
            Magic.Cards.where({name: query}).then(results => {
                cardDeets(results[0],1,from);
            });
        }
        // SAY MY NAME
        if(text.indexOf(config.botName) !== -1){
            whisper("Hi there, "+from+". Type !help for help.",from);
        }
    }
});

var path = "C:/Users/Princess Lexi-Lexi/Documents/Unp/";
var music = path+"unp_now_playing.txt";
var magic = path+"magic.txt";

// say the playing track in chat
watch(music, function(filename) {
    fs.readFile(music, 'utf8', function (err,data) {
        if (err) {
            return console.log(err);
        }
        bot.say(config.channels[0], "Now listening to: "+data);
    });
});

// Post the card reader card
watch(magic, function(filename) {
    fs.readFile(magic, 'utf8', function (err,data) {
        if (err) {
            return console.log(err);
        }
        Magic.Cards.find(data).then(result => cardDeets(result,0,"Card: "));
    });

});

// card posting
function cardDeets(res, details,  from){
    if(details){
        whisper(res.name +" - "+res.manaCost,from);
        whisper(res.text,from);
        whisper("http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid="+res.multiverseid,from);
    }else{
        bot.say(config.channels[0], description+res.name +" - "+res.manaCost);
        bot.say(config.channels[0], "http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid="+res.multiverseid);
    }
}

// Type into console.
stdin.addListener("data", function(d) {
    var inp = d.toString().trim();
    consoleSay(inp);
});


function consoleSay(inp){
    if(inp.toLowerCase().startsWith("!chat")){
        chatMode = chatMode?0:1;
        var msg = "/me -- CHAT MODE IS "+(chatMode?"ON":"OFF")+" --";
        consoleOutput(msg);
        bot.say(config.channels[0], msg);
    }else if(inp.toLowerCase().startsWith("!lastfollow")){
        if(!inp.toLowerCase().startsWith("!lastfollow -q"))
            bot.say(config.channels[0], "\/me "+latestFollower+" is now following LevelDownGirls");
//        console.log(latestFollower+" is the latest follower");
        consoleOutput(latestFollower+" is the latest follower");
    }else if(inp.toLowerCase().startsWith("!spoof ")){
        inp = inp.substring(7);
        consoleOutput("spoofing "+inp);
//        console.log("spoofing "+inp);
        newFollower(inp);
    }else if(inp.toLowerCase().startsWith("!help")){
        startup();
    }else if(inp.toLowerCase().startsWith("!flood ")){
        inp = inp.toLowerCase().substring(7); //remove command
        inp = inp.replace(/^\s+|\s+$/g, ""); //trim whitespace
        bot.activateFloodProtection(inp);
//        console.log( " -- FLOOD PROTECTION SET TO "+inp+" --" );
        consoleOutput( " -- FLOOD PROTECTION SET TO "+inp+" --" );
    }else if(inp.startsWith("!")){
        //dont print malformed commands
    }else{
        // do print everything else
        bot.say(config.channels[0], inp);
    }
}

function consoleOutput(text){
    if(text.startsWith("/me")){
        text = text.substring(4); //remove command
        //text = "<b>"+text+"</b>";
    }
    io.emit('chat message', text);
    console.log(text);
}


var options = {
    url: 'https://api.twitch.tv/kraken/channels/leveldowngirls/follows?&limit=25&offset=0',
    headers: {
        'Client-ID': 'fjuqde8drx14ae30yyr3g4stvm0ekz'
    }
};

var latestFollower = "";
function checkFollowers(first){
    request(options, function (error, response, body) {
        followers = JSON.parse(body);
        var latest = followers["follows"][0]["user"]["display_name"];
        if(latest != latestFollower){
            latestFollower = latest;
            if(!first){
                newFollower(latest);
            }
        }
    });
    function callback(){

    }
}

function newFollower(name){
    bot.say(config.channels[0], "/me "+name+" is now following LevelDownGirls");
    request
        .get("http://localhost:8888/?follow="+name)
        .on('error', function(err){
            console.log("Error sending follow notification for "+name+". Did you start the notifier?");
        })
}

checkFollowers(1);
setInterval(function(){checkFollowers(0)}, 60*1000);

// save follower info to a file to call back from OBS viewer thing

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');

});


io.on('connection', function(socket){
    socket.on('chat message', function(msg){
        io.emit('chat message', msg);
//        console.log( msg);
        consoleSay(msg);
    });
});

http.listen(8080, function(){
    console.log('listening on *:8080');
});
