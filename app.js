var Slack = require('slack-node');
var fs = require('fs');
var path = require('path');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var Promise = require('bluebird');

var host = 'https://circle-artifacts.com/gh/';
var projectUserName = process.env.CIRCLE_PROJECT_USERNAME; // github user name
var buildNum = process.env.CIRCLE_BUILD_NUM; // 20
var targetDirPath = process.env.CIRCLE_ARTIFACTS; // /tmp/xxxx/
var url = host + projectUserName + '/' + buildNum + '/artifacts/0/' + targetDirPath;

var userName = process.env.CIRCLE_USERNAME; // github user name

var apiToken = process.env.SLACK_API_TOKEN; // https://api.slack.com/web
var channel = process.env.SLACK_CHANNEL; // #channel

getXmlFiles(targetDirPath).then(function (files){

  var params = [];
  files.forEach(function (file){
    params.push(getParsedXmlAsJs(targetDirPath + file));
  });
  return Promise.all(params);

}).then(function(parsedFiles){

  var filesHaveIssues = [];
  parsedFiles.forEach(function (obj){
    var regexp = new RegExp(".+\/(.+)$");
    var matches = null;
    if(obj.content && obj.content.jslint && obj.content.jslint.file){
      matches = regexp.exec(obj.file);
      filesHaveIssues.push(url + '/' + matches[1]);
    }
  });

  if(filesHaveIssues.length > 0){

    var slack = new Slack(apiToken);

    var body = userName + "'s push has following lint issues, pls check it out. \n";
    filesHaveIssues.forEach(function (url){
      body += url + "\n";
    });
    slack.api('chat.postMessage', {text: body, channel: channel}, function(){});
  }

});

function getXmlFiles(targetDirPath){
  return new Promise (function (resolve, reject){
    fs.readdir(targetDirPath, function (err, files) {
      var filesList = [];
      files.forEach(function (file) {
        if (file.match(/.+gjslint\.xml$/)){
          filesList.push(file);
        }
      });
      resolve(filesList);
    });
  });
}

function getParsedXmlAsJs(file){
  return new Promise(function(resolve, reject){
    fs.readFile(file, function(err, data){
      parser.parseString(data, function (err, parsed) {
        if(err){
          reject(err);
        }
        resolve({
          file: file,
          content: parsed
        });
      });
    });
  });
}

