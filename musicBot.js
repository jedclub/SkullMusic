var Discord = require("discord.js");
var request = require("superagent");
var logger = require('winston');
var auth = require('./auth.json');

var ttsCtrl = require('./ttsCtrl.js');
var Dequeue = require('dequeue')

var playList = new Dequeue();

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// discord client
var client = new Discord.Client();

// Debug and warning handlers, these log debug messages and warnings to console
client.on("debug", (m) => console.log("[debug]", m));
client.on("warn", (m) => console.log("[warn]", m));

// exception process
function error(e) {
	console.log(e.stack);
	process.exit(0);
}

// login
client.login(auth.token);

var currentVoiceConnection;
var defaultVoiceChannel;
var currentPlayDispatcher;
var youtubeDispatcher;
var voiceVolume = 1.0;
var youtubeVolume = 0.1;
var offTTS = false;
var voiceChannelID = auth.voiceChannelID;
// var connectVoice;

client.on('ready', () => {
	logger.info('discord ready.');
  
	var channel = client.channels.get( voiceChannelID );
	defaultVoiceChannel = channel; 
  
	if (channel instanceof Discord.VoiceChannel) {
		logger.info( channel.name + ' - ' + channel.id);
	}
	
	channel.join().then( function( connection ) {  connectVoice = connection; logger.info('Connected! voice channel.') } ).catch(error);
	
	setInterval(playMusic, 3000);
});

var ttsEnd = true;
var youTubeEnd = true;

const playMusic = function() {
	
	if( playList.length != 0 ) {
		// logger.info( 'playList.empty() is false' );
		if( youTubeEnd && ttsEnd ) {
		
			var music = playList.pop();

			logger.info( 'music url : ' + music.url );
			logger.info( 'music comment : ' + music.comment );
				
			if( music ) {
				music.user.sendMessage(music.user.username + '님 께서 신청하신 신청 곡이 연주 됩니다.');
					
				if( music.comment.length > 1 )	{
					ttsEnd = false;
					sendTTS( music.comment, function() {
						if( ttsEnd == false ) {
							youTubeEnd = false;
							playYoutube( music.url, function() {
								if( youTubeEnd == false ) {
									youTubeEnd = true;
								}
							});
							ttsEnd = true;
						}
					});
				}
				else {
					youTubeEnd = false;
					playYoutube( music.url, function() {
						if( youTubeEnd == false ) {
							youTubeEnd = true;
						}
					});
				}
			}
		}
	}
}



const playYoutube = function( youTubeURL, endCallBack ) {
	
	if (defaultVoiceChannel && youTubeURL.length >= 1) {
		
		if( defaultVoiceChannel )	{
			defaultVoiceChannel.leave();
		}
		
		// Play streams using ytdl-core
		const ytdl = require('ytdl-core');
		const streamOptions = { seek: 0, volume: youtubeVolume }; 
		defaultVoiceChannel.join()
		.then( connection => {
			currentVoiceConnection = connection;
			const stream = ytdl( youTubeURL, { filter : 'audioonly' });
			youtubeDispatcher = connection.playStream(stream, streamOptions);
			youtubeDispatcher.setVolume(youtubeVolume);
			
			youtubeDispatcher.on('volumeChange', function(oldVol,newVol) {
				logger.info('youtube volumeChange : ' + oldVol + ' / ' + newVol );
				
				youtubeDispatcher.on('end', function() {
					logger.info('youtubeDispatcher end');
					endCallBack();
			});
			
			youtubeDispatcher.on('speaking', function() {
				logger.info('youtubeDispatcher speaking : ' + youTubeURL );
			});
				
			});
		}).catch(error);
	}
}

const sendTTS = function(ttsMsg, endCallBack ) {
	
	if (defaultVoiceChannel && ttsMsg.length >= 1) {
		logger.info('TTS Say : ' + ttsMsg);
		
		if( defaultVoiceChannel )	{
			defaultVoiceChannel.leave();
		}
				
		defaultVoiceChannel.join().then( connection => {
			currentVoiceConnection = connection;
			ttsCtrl.loadTTS(ttsMsg, function(mp3FileName) { 
			logger.info('play mp3');
			const streamOptions = { seek: 0, volume: voiceVolume };
			const dispatcher = connection.playFile(mp3FileName, streamOptions);
			currentPlayDispatcher = dispatcher;
			currentPlayDispatcher.setVolume(voiceVolume);
			
			dispatcher.on('end', function() {
				logger.info('play end');
				endCallBack();
			});
			
			dispatcher.on('error', function() {
				logger.info('play error');
			});
			
			dispatcher.on('speaking', function() {
				logger.info('play speaking');
			});
			
			dispatcher.on('volumeChange', function(oldVol,newVol) {
				logger.info('voice volumeChange : ' + oldVol + ' / ' + newVol );
			});
			
			
			}) 
		}).catch(error);
	}
}

client.on('message', message => {
	 
	var msg = message.content;
	
	if (msg.substring(0, 1) == '!') {
        var args = msg.substring(1).split(' ');
        var cmd = args[0];
        var text = msg.substring(1).replace(cmd + ' ','');
        
	   
        args = args.splice(1);
		
		logger.info('cmd : '  + cmd );
		 
		switch(cmd) {
            // !ping
            case 'ping':
                
				message.reply('pong > ' + text);
				
                break;
            case 'reg':
				break;
			case 'say' :
				//sendTTS(text);
				break;
			case 'cc' : 
				
				if( voiceChannelID == auth.voiceChannelID )	{
					voiceChannelID = auth.voiceChannelID2;
				}
				else if( voiceChannelID == auth.voiceChannelID2 )	{
					voiceChannelID = auth.voiceChannelID;
				}
				
				client.destroy();
				client = new Discord.Client();
				client.login(auth.token);
				
				client.setTimeout(function(msg) {
					msg.reply( 'change ok > ' + defaultVoiceChannel.name );
				}, 3000, message);

				break;
			case 'ttsVol' : 
				voiceVolume = parseFloat(text);
				message.reply('volume > ' + voiceVolume);
				break;
				
			case 'add' : 
			
				var input = text.split(' ');
				var url = input[0];
				input.splice(0, 1);
				var comment = input.join(' ');
				
				//message.reply('url > ' + url);
				//message.reply('comment > ' + comment);
				
				//logger.info(message.id);
				
				var musicObj = { url : url, comment : comment, user : message.author };
				//logger.info('musicObj : '  + musicObj.toString() );
				playList.push( musicObj );
				
				message.reply( playList.length + '번 째로 음악이 신청 되었습니다.');
				//playYoutube( url );
				//offTTS = true;
			// https://www.youtube.com/watch?v=ERadk2c8KPA
				break;
			case 'help' :
				message.reply('[음악 신청 방법]');
				message.reply('유튜브 URL 을 이용해서 음악 신청 가능. 다음과 같이 입력.');
				message.reply('(느낌표)add https://www.youtube.com/watch?v=mRWxGCDBRNY 감성 음악 신청 합니다.');
				
				//message.reply('[볼륨 조절 방법]');
				//message.reply('볼륨 값은 1~0 까지 소숫 점을 이용하여 조절 가능. 다음과 같이 입력. 보통 0.1 ~ 0.03 사이 값을 추천.');
				//message.reply('!vol 0.1');
				
				break;
			case 'next' :
				if( youtubeDispatcher ) {
					youtubeDispatcher.end();
				}
				break;
			case 'vol' :
				youtubeVolume = parseFloat(text);
				if( youtubeDispatcher ) {
					youtubeDispatcher.setVolume(youtubeVolume);
					message.reply('volume > ' + youtubeVolume);
				}
				break;
		}
	}
});