var Discord = require("discord.js");
var request = require("superagent");
var logger = require('winston');
var validUrl = require('valid-url');
var auth = require('./auth.json');

var ttsCtrl = require('./ttsCtrl.js');
//var Dequeue = require('dequeue')

var playList = [];//= new Dequeue();

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// discord client
var client = new Discord.Client();

// Debug and warning handlers, these log debug messages and warnings to console
//client.on("debug", (m) => console.log("[debug]", m));
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
var voiceVolume = 0.8;
var youtubeVolume = 0.07;
var offTTS = false;
var voiceChannelID = auth.voiceChannelID;
// var connectVoice;

client.on('ready', () => {
	logger.info('client ready event > discord ready.');
	logger.info('client ready event > my id : ' + client.user.id.toString());
	logger.info('client ready event > my name : ' + client.user.username.toString());
  
	var channel = client.channels.get( voiceChannelID );
	defaultVoiceChannel = channel; 
  
	if (channel instanceof Discord.VoiceChannel) {
		logger.info( channel.name + ' - ' + channel.id);
	}
	
	channel.join().then( function( connection ) {  connectVoice = connection; logger.info('Connected! voice channel.') } ).catch(error);
	
	setInterval(playMusic, 5000);
});

var ttsEnd = true;
var youTubeEnd = true;
var currentPlayMusic;

const playMusic = function() {
	
	if( playList.length != 0 ) {
		// logger.info( 'playList.empty() is false' );
		if( youTubeEnd && ttsEnd ) {
		
			var music = playList.shift();//pop();
			currentPlayMusic = music;
			logger.info( 'playMusic > playList.length : ' + playList.length );

			logger.info( 'playMusic > music url : ' + music.url );
			logger.info( 'playMusic > music comment : ' + music.comment );

			if( music ) {
				music.user.sendMessage(music.user.username + '님 께서 신청하신 신청 곡이 연주 됩니다.');
				logger.info( 'playMusic > user name : ' + music.user.username );

				if( music.comment.length > 1 )	{
					ttsEnd = false;
					youTubeEnd = false;
					sendTTS( music.comment, function() {
						if( ttsEnd == false ) {
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
	
	logger.info('playYoutube > call playYoutube');
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
			
			youtubeDispatcher.on('end', function() {
					logger.info('playYoutube > youtubeDispatcher end');
					endCallBack();
			});
				
			youtubeDispatcher.on('volumeChange', function(oldVol,newVol) {
				logger.info('playYoutube > youtube volumeChange : ' + oldVol + ' / ' + newVol );
			});	
			
			youtubeDispatcher.on('error', function() {
				logger.info('playYoutube > play error');
				endCallBack();
			});
			
			youtubeDispatcher.on('speaking', function() {
				logger.info('playYoutube > youtubeDispatcher speaking : ' + youTubeURL );
			});
			
			currentVoiceConnection.on('playYoutube > speaking', function(user, speaking) { 
				logger.info('playYoutube > speaking = ' + user.username +  ' / say = ' + speaking.toString() ); 
				// youtubeDispatcher.setVolume(youtubeVolume);
			});
			
		}).catch(function(e){ error(e); endCallBack(); });
	} else {
		endCallBack();
	}
}

const sendTTS = function(ttsMsg, endCallBack ) {
	
	if (defaultVoiceChannel && ttsMsg.length >= 1) {
		logger.info('sendTTS > TTS Say : ' + ttsMsg);
		
		if( defaultVoiceChannel )	{
			logger.info('sendTTS > defaultVoiceChannel.leave');
			defaultVoiceChannel.leave();
		}

		defaultVoiceChannel.join().then( connection => {
			logger.info('sendTTS > join');
			currentVoiceConnection = connection;
			ttsCtrl.loadTTS(ttsMsg, function(mp3FileName) { 
			logger.info('sendTTS > play mp3 = ' + mp3FileName);
			const streamOptions = { seek: 0, volume: voiceVolume };
			const dispatcher = connection.playFile(mp3FileName, streamOptions);
			currentPlayDispatcher = dispatcher;
			currentPlayDispatcher.setVolume(voiceVolume);
			
			dispatcher.on('end', function() {
				logger.info('sendTTS > play end');
				endCallBack();
			});
			
			dispatcher.on('error', function() {
				logger.info('sendTTS > play error');
				endCallBack();
			});
			
			dispatcher.on('speaking', function() {
				logger.info('sendTTS > play speaking');
			});
			
			dispatcher.on('volumeChange', function(oldVol,newVol) {
				logger.info('sendTTS > voice volumeChange : old = ' + oldVol + ' / new = ' + newVol );
			});
			
			
			}) 
		}).catch(function(e){ error(e); endCallBack(); });
	} else {
		endCallBack();
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
		
		const checkDM = function(msgInfo) {
			if( msgInfo.channel.type != 'dm' ) {
				msgInfo.author.send('[Bot] Dj유미의 기능은 모두 개인 메세지로만 실행이 가능합니다.');
				msgInfo.author.send('자세한 사용방법은 !help 명령을 이용해 보세요.');
				return false;
			}
			return true;
		}
		
		const checkAdmin = function(msgInfo) {
			
		}

		if( cmd.length > 1 ){
		 
			switch( cmd ) {
				// !ping
				case 'ping':
					
					message.reply('pong > ' + text);
					
					break;
					
				case 'reg':
					break;
					
				case 'say' :
					//sendTTS(text);
					break;
					
				case 'cc' :  // 채널 전환 명령
					
					if( message.channel.type == 'dm' ){
					
						if( voiceChannelID == auth.voiceChannelID )	{
							voiceChannelID = auth.voiceChannelID2;
						}
						else if( voiceChannelID == auth.voiceChannelID2 )	{
							voiceChannelID = auth.voiceChannelID;
						}
						
						joinVoiceChannel(voiceChannelID);
					
						client.setTimeout(function(msg) {
							msg.reply( 'change ok > ' + defaultVoiceChannel.name );
						}, 3000, message);
					}
					else {
						logger.info( 'not dm' );
					}

					break;
					
				case 'ttsVol' : // TTS 볼륨 조절
				
					if( !checkDM(message) ){ break; }
					
					voiceVolume = parseFloat(text);
					message.reply('volume > ' + voiceVolume);
					break;
					
				case 'add' : // 유튜브 음악 추가 
				
					if( !checkDM(message) ){ logger.info( 'not dm' ); break; }
					if( client.user.id != message.author.id ) {
				
						var input = text.split(' ');
						var url = input[0];
						input.splice(0, 1);
						var comment = input.join(' ');
						
						logger.info( 'add youtube URL : ' + url );
						logger.info( 'add comment : ' + comment );
						
						if( !validUrl.isUri(url) ) {
							message.reply('명령어가 잘못 입력 되었습니다. ');
							message.reply('잘못 된 유튜브 경로이거나, 명령어와 유튜브 주소 사이에 추가 공백이 있는지 확인하세요.');
							
							break;
						}
						
						var musicObj = { url : url, comment : comment, user : message.author };

						playList.push( musicObj );
						
						message.reply( playList.length + '번 째로 음악이 신청 되었습니다.');
					}
					break;
					
				case 'help' :	// 명령어 사용 방법 출력 
				
					if( message.channel.type == 'dm' ){
					
						message.reply('[음악 신청 방법]');
						message.reply('유튜브 URL 을 이용해서 음악 신청 가능. 다음과 같이 입력.');
						message.reply('!add https://www.youtube.com/watch?v=mRWxGCDBRNY 감성 음악 신청 합니다.');
					}
					//message.reply('[볼륨 조절 방법]');
					//message.reply('볼륨 값은 1~0 까지 소숫 점을 이용하여 조절 가능. 다음과 같이 입력. 보통 0.1 ~ 0.03 사이 값을 추천.');
					//message.reply('!vol 0.1');
					
					break;
					
				case 'next' :	// 다음 음악으로 스킵 
				
					if( !checkDM(message) ){ break; }
					
					youTubeEnd = true;
					ttsEnd = true;
					
					if( youtubeDispatcher ) {
						youtubeDispatcher.end();
					}
					
					break;
				case 'vol' :
					if( !checkDM(message) ){ break; }
					
					youtubeVolume = parseFloat(text);
					if( youtubeDispatcher ) {
						youtubeDispatcher.setVolume(youtubeVolume);
						message.reply('volume > ' + youtubeVolume);
					}
					break;
			}
		}
	}
});
