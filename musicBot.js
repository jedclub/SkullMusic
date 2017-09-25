const Discord = require("discord.js");
const request = require("superagent");
const logger = require('winston');
const validUrl = require('valid-url');
const ytdl = require('ytdl-core');
const auth = require('./auth.json');

const ttsCtrl = require('./ttsCtrl.js');
//var Dequeue = require('dequeue')

const playList = [];//= new Dequeue();

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// discord client
const client = new Discord.Client();

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

	joinVoiceChannel(voiceChannelID);

	setInterval(playMusic, 5000);
});

const joinVoiceChannel = function(vID) {

	var channel = client.channels.get( vID );
	defaultVoiceChannel = channel;

  //defaultVoiceChannel.setBitrate(8);

	if (channel instanceof Discord.VoiceChannel) {
		logger.info( channel.name + ' - ' + channel.id);
	}

	channel.join().then( function( connection ) {  connectVoice = connection; logger.info('Connected! voice channel.') } ).catch(error);
}

var ttsEnd = true;
var youTubeEnd = true;
var currentPlayMusic;

const playMusic = function() {

	if( playList.length != 0 ) {
		if( youTubeEnd && ttsEnd ) {

			var music = playList.shift();//pop();

			currentPlayMusic = music;

			logger.info( 'playMusic > playList.length : ' + playList.length );

			if( music ) {
				music.user.sendMessage(music.user.username + '님 께서 신청한 ' + music.title +' 연주 됩니다.');

        var st_date = new Date().toISOString().substr(0, 10).replace('T', ' ');
        logger.info( 'playMusic > play time = ' + st_date );
				logger.info( 'playMusic > user name : ' + music.user.username );
				logger.info( 'playMusic > music url : ' + music.url );
				logger.info( 'playMusic > music comment : ' + music.comment );

				logger.info( 'playMusic > youtube info length = ' + music.length.toString());
				logger.info( 'playMusic > youtube info thumbnail = ' + music.thumbnail );
				logger.info( 'playMusic > youtube info title = ' + music.title );

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
		const streamOptions = { seek: 0, volume: youtubeVolume };
		defaultVoiceChannel.join()
		.then( connection => {
			currentVoiceConnection = connection;
			const stream = ytdl( youTubeURL, { filter : 'audioonly' }); // , quality : 'lowest'
			youtubeDispatcher = connection.playStream(stream, streamOptions);
      youtubeDispatcher.setBitrate(32);
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

      /*
			currentVoiceConnection.on('playYoutube > speaking', function(user, speaking) {
				logger.info('playYoutube > speaking = ' + user.username +  ' / say = ' + speaking.toString() );
				// youtubeDispatcher.setVolume(youtubeVolume);
			});
      */

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

    const checkPlayMe = function(msgInfo) {
      if( currentPlayMusic ) {
        if( msgInfo.author.id == currentPlayMusic.user.id ) {
          return true;
        }
      }
      return false;
    }

    const checkAdmin = function(msgInfo) {
      return auth.adminID.find( function(ids) { return ( ids == msgInfo.author.id ); });
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

            if( checkAdmin(message) ){
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

						ytdl.getInfo(url, function(error, info) {

							if( error ){
								message.reply('잘못된 youTube URL 입니다.');
							} else {

								var length = ( info.length_seconds / 60 );
								var thumbnail = info.thumbnail_url;
								var title = info.title;

                if( length >= 7 && !checkAdmin(message) ) {
                  message.reply( '신청하신 음악은 ' + length.toFixed(2).toString() + '분 입니다.' );
                  message.reply( '7분 이하의 곡만 신청이 가능 합니다.' );
                  return;
                }

								var musicObj = { url : url, comment : comment, user : message.author, length : length, thumbnail : thumbnail, title : title };

								playList.push( musicObj );

								if( playList.length == 1 && youTubeEnd == true && ttsEnd == true ){
									message.reply( '음악이 신청 되었습니다.' );
								} else {
									message.reply( '음악이 신청(예약) 되었습니다. 신청한 음악이 재생 되기 까지 ' + playList.length + '번(대기) 남았습니다.');
								}
							}
						});
					}
					break;

				case 'help' :	// 명령어 사용 방법 출력

					if( message.channel.type == 'dm' ){

            const embed = new Discord.RichEmbed()
            .setAuthor('DJ 유미 사용 방법!')
            .addBlankField(true)
            .addField('[음악 신청 방법]', '유튜브 URL 을 이용해서 음악 신청 가능. 다음과 같이 입력. \n!add https://www.youtube.com/watch?v=mRWxGCDBRNY 감성 음악 신청 합니다.', true)
            .addField('[현재 플레이 음악 정보 확인]', '지금 플레이 되는 음원 정보를 다음과 같이 입력. \n!now', true)
            .addField('[다음 음악으로 전환]', '플레이되고 있는 음악을 중단하고 다음 대기열 음악을 재생. (내가 신청한 음악만 중단 가능) \n!next', true)
            .addField('[볼륨 조절]', '플레이되고 있는 음악의 보륨을 조절 1 ~ 0 사이의 소수 값을 입력. (내가 신청한 음악만 조절 가능) \n!vol 0.5', true)
            message.author.send({embed});
					}

					//message.reply('[볼륨 조절 방법]');
					//message.reply('볼륨 값은 1~0 까지 소숫 점을 이용하여 조절 가능. 다음과 같이 입력. 보통 0.1 ~ 0.03 사이 값을 추천.');
					//message.reply('!vol 0.1');

					break;
				case 'now' :

					if( !checkDM(message) ){ logger.info( 'not dm' ); break; }
					if( currentPlayMusic ) {
						
						var nowPlayListCntMsg;
						if( playList.length == 0 ) {
					   		nowPlayListCntMsg = '현재 대기 중인 음악이 없습니다.';
				   		}
				   		else {
					   		nowPlayListCntMsg = playList.length + '곡이 대기중 입니다.';
				   		}
						
						const embed = new Discord.RichEmbed()
						  .setAuthor("다음 곡이 재생 중입니다.")
              .setTitle(currentPlayMusic.title)
              .setThumbnail("http://www.freeiconspng.com/uploads/youtube-subscribe-png-28.png")
						  /*
						   * Alternatively, use "#00AE86", [0, 174, 134] or an integer number.

              /*
						  .setColor(0x00AE86)
						  .setDescription("This is the main body of text, it can hold 2048 characters.")
						  .setFooter("This is the footer text, it can hold 2048 characters", "http://i.imgur.com/w1vhFSR.png")
						  .setImage("http://i.imgur.com/yVpymuV.png")

						  /*
						   * Takes a Date object, defaults to current date.
						   */
              .setImage(currentPlayMusic.thumbnail)
						  .setTimestamp()
						  .setURL(currentPlayMusic.url)
              /*
						  .addField("This is a field title, it can hold 256 characters",
							"This is a field value, it can hold 2048 characters.")

						  .addField("Inline Field", "They can also be inline.", true)

						   */
               .addField('음원 시간', currentPlayMusic.length.toFixed(2).toString() + '분')
			   .addField('다음 대기 음악', nowPlayListCntMsg)
               .addBlankField(true);
              /*
						  .addField("Inline Field 3", "You can have a maximum of 25 fields.", true);
              */

						  message.author.send({embed});

						//message.author.send
					}

					break;

				case 'next' :	// 다음 음악으로 스킵

					if( !checkDM(message) ){ break; }
          if( checkPlayMe(message) || checkAdmin(message) ){
            youTubeEnd = true;
  					ttsEnd = true;

  					if( youtubeDispatcher ) {
  						youtubeDispatcher.end();
  					}
          }

					break;

				case 'vol' :  // 볼륨 조절
            var vol = parseFloat(text);

            if( vol > 1 || vol < 0 ) {
              message.reply('볼륨 값 1 부터 0사이의 값을 입력 하세요.');
              message.reply('예) !vol 0.5');
              break;
            }

            vol = vol * 0.15;

            if( !checkDM(message) ){ break; }
            if( checkPlayMe(message) ){

              if( youtubeDispatcher ) {
                youtubeDispatcher.setVolume( vol );
                message.reply( '볼륨이 변경 되었습니다.' );
    					}
            } else if ( checkAdmin(message) ) {
              youtubeVolume = vol;

              if( youtubeDispatcher ) {
                youtubeDispatcher.setVolume( youtubeVolume );
                message.reply( '볼륨이 변경 되었습니다.' );
    					}
            }

					break;
			}
		}
	}
});
