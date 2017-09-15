var crypto = require('crypto');
const gTTS = require('gtts');

// var ttsInfo = require('./ttsInfo.json');

exports.loadTTS = function (ttsStr, loadComplete) {
  var fs = require('fs');
  var ttsID = crypto.createHash('md5').update(ttsStr).digest('hex');
  var mp3FileName = './tts/' + ttsID + '.mp3';
  
  if( fs.existsSync(mp3FileName) )
  {
     console.log('Success! Open file ' + mp3FileName + ' to hear result.');
    loadComplete(mp3FileName); 
  }
  else
  {
    var gtts = new gTTS(ttsStr, 'ko');
  
    gtts.save(mp3FileName, function (err, result) {
      if(err) { throw new Error(err) }
      console.log('Success! Open file ' + mp3FileName + ' to hear result.');
      loadComplete(mp3FileName);
    });
  }

};
/* 
exports.circumference = function (r) {
    return 2 * PI * r;
};
*/
