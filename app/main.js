'use strict';

// basic requirements
const electron = require('electron');
const path = require('path');
const {dialog} = require('electron');

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;


// this should be placed at top of main.js to handle setup events quickly
if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  return;
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  if (process.platform != "win32")
    return false;

  const ChildProcess = require('child_process');
  //const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit();
      return true;
  }
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win = null;

let widevineVersion = '1.4.8.903';
let baseWidevinePath ='../widevine/'+widevineVersion+'/';
var widevine_adapter_path ='';

switch(process.platform)
{
      case "win32":
        widevine_adapter_path = baseWidevinePath+process.platform + "/" + process.arch +'/widevinecdmadapter.dll';
      break;
      default:
        widevine_adapter_path = baseWidevinePath+'mac_x64/widevinecdmadapter.plugin';
      break;
}

app.commandLine.appendSwitch('widevine-cdm-path', path.join(__dirname, widevine_adapter_path));
app.commandLine.appendSwitch('widevine-cdm-version', widevineVersion);

// default video screen size
var video_dimensions = {
  width: 800,
  height: 480
};


function getSubstring(org_string, tag, divider) {
  var found_string = "";

  var first_index = org_string.indexOf(tag);
  if(parseInt(first_index) >= 0) {
    var next_index = org_string.indexOf('&', first_index);

    if (parseInt(next_index) >= 0) // if there's divider
      found_string = org_string.substring(first_index + tag.length, next_index);
    else  // if it's end of string
      found_string = org_string.substring(first_index + tag.length, org_string.length);
  }

  return found_string;
}

function parseVideoSize(param_string) {
var width_tag = "width=";
var height_tag = "height=";

  // let's find width first
  var found_width = parseInt(getSubstring(param_string, width_tag, '&'));
  var found_height = parseInt(getSubstring(param_string, height_tag, '&'));

  if (found_width <= 0 || found_height <= 0)
    return false;   // no valid param for video size

  video_dimensions.width = found_width;
  video_dimensions.height = found_height;

  //dialog.showMessageBox({ message: 'width: ' + video_width + ', height: ' + video_height, buttons: ["OK"]});

  return true;
}

// command line arguments
var argument = '';

// setting for custom url scheme
app.setAsDefaultProtocolClient('pallycon-electron');

// for Mac OS only
function onOpenUrl(e, parameter) {
  e.preventDefault();

  //dialog.showMessageBox({ message: parameter, buttons: ["OK"] });

  var temp = parameter.split("?");

  if (temp.length > 1) {
    argument = '?'+temp[1];
    if (win !== null && win.isVisible()) {
    //if (win !== null) {
      if (parseVideoSize(argument) === true) {
          win.setSize(video_dimensions.width, video_dimensions.height);
          win.setAspectRatio(video_dimensions.width / video_dimensions.height);
      }

      win.loadURL(`file://${__dirname}/webview.html`+argument);
    }
  }
}

function testDashDownload(mpd_url) {
  // mpd parsing test
  var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
  var xhr = new XMLHttpRequest();

  if (xhr === null) return false;

  xhr.onreadystatechange = function() {
    console.log("State: " + xhr.readyState);

    if (xhr.readyState === 4) {
      console.log("Complete.\nBody length: " + xhr.responseText.length);
      //console.log("Body:\n" + xhr.responseText);

      var xmlDoc = xhr.responseXML;
      console.log(xhr.responseText);
/*
      var baseUrls = xmlDoc.getElementsByTagName("BaseURL");

      for (var i=0; i<baseUrls.length; i++) {
        var base_url = baseUrls[i].text;

        console.log(base_url);
        //dialog.showMessageBox( { message: base_url, buttons: ["OK"]});
      }
*/
    }
  };

  xhr.open("GET", mpd_url, true);

  // If specified, responseType must be empty string or "document"
  xhr.responseType = 'document';

  // overrideMimeType() can be used to force the response to be parsed as XML
  //xhr.overrideMimeType('text/xml');

  xhr.send(null);
}

function createWindow() {
  // for Windows only
  if (parseInt(process.platform.indexOf('darwin')) < 0 && process.argv.length > 1) {
    //console.log(process.argv[0]);
    //console.log(process.argv[1]);

    var playback_tag = 'pallycon-electron://playback/';     // Windows는 이상하게 맨 끝에 '/'이 추가됨..
    var url_index = process.argv[1].indexOf(playback_tag);
    if(parseInt(url_index) >= 0) {
      argument = process.argv[1].substring(url_index + playback_tag.length, process.argv[1].length);
    }
  }

  if (argument.length > 0 ) {
      parseVideoSize(argument);
  }
  /*
  else  {   // for test
    var sample_mpd_path = path.join(__dirname, '../video/cosmos-1080p/stream.mpd');
    dialog.showMessageBox({ message: sample_mpd_path, buttons: ["OK"]});

    argument = "?la_url=https://tokyo.pallycon.com/ri/licenseManager.do&stream_url=" + sample_mpd_path + "&custom_data=W8KAJjimCMbmPlROv7bbMkm7fuC8qQ+osxrPGaMUufCgtc4guFSZOjm4hZr/OaxPXFlYVrY1jRvFS6MgJYnImgx3gVzz0f7z593c1+C2lWH4DtEo=&video_width=1020&video_height=480";
  }
  */

  var mainpagePath = `file://${__dirname}/webview.html`+argument;

  // Create the browser window.
  win = new BrowserWindow({
    width: video_dimensions.width,
    height: video_dimensions.height,
    backgroundColor: '#000',
    webPreferences: {
      plugins: true
    }
  });

  win.setAspectRatio(video_dimensions.width / video_dimensions.height);

  // and load the index.html of the app.
  win.loadURL(mainpagePath);

  // dash download test
  testDashDownload("https://pallycon.com/pallycon-contents/cosmos-1080p/stream.mpd");

  // Open the DevTools.
  //win.webContents.openDevTools();
//  if (argument.length > 0)
  //  dialog.showMessageBox({ message: argument, buttons: ["OK"]});

  //console.log(mainpagePath);
  //console.log(path.join(__dirname, widevine_adapter_path));

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });
}

// for Mac OS only
app.on('open-url', onOpenUrl);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
