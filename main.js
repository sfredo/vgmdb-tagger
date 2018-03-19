#!/usr/bin/env node
const { stdin } = require('process');
const path = require('path');
const fs = require('fs');
const recursive = require("recursive-readdir");
const minimist = require('minimist');
const prompt = require('prompt');
const request = require('request-promise-native');
const id3 = require('node-id3');
const colors = require("colors/safe");

prompt.message = colors.yellow('');
prompt.start();
const args = minimist(process.argv.slice(2), {});

function usage() {
  const prog = path.basename(process.argv[1]);
  process.stderr.write(`Usage: ${ prog } [-u URL_TO_ALBUM] [FOLDER]\n\n`);
  process.stderr.write(`    -u URL_TO_ALBUM     URL to album on vgmdb.info\n`);
  process.stderr.write(`    FOLDER              Folder to parse.\n`);
  process.exit(1);
}

function readFromTerminal(input, description) {
  var schema = {
    properties: {}
  };
  schema.properties[input] = {
    message: colors.blue(description)
  };
  return new Promise((resolve, reject) => {
    prompt.get(schema, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function main() {
  try {
    // must be run on terminal
    if (!stdin.isTTY) usage();
    if (!args.u) usage();
    if (args._.length != 1) usage();

    if (args.u.substr(-12) != '?format=json') args.u += '?format=json'; 
    const folder = args._[0];

    // read existing tags
    const files = await recursive(folder);
    const fileTags = {};
    let oldArtist;
    let oldAlbum;
    for (file in files) {
      if (files[file].substr(-4) == '.mp3' || files[file].substr(-4) == '.m4a') {
        const fullPath = files[file];
        fileTags[fullPath] = id3.read(fullPath);
        oldArtist = oldArtist || fileTags[fullPath].artist;
        oldAlbum = oldAlbum || fileTags[fullPath].album;
      }
    }
    
    // gets new tags from the web
    const data = JSON.parse(await request(args.u));
    let newArtist = [];
    let newAlbum;
    const newTracks = [];
    for (i in data.composers) {
      if (data.composers[i].names.en) newArtist.push(data.composers[i].names.en);
    }
    newArtist = newArtist.join(';');
    newAlbum = data.names.en || data.names;

    // reads tracks from one or multiple discs
    let total = 1;
    let comparisonTotal = 1;
    let multiDisc = (data.discs.length > 1);
    for (i in data.discs) {
      for (j in data.discs[i].tracks) {
        const names = data.discs[i].tracks[j].names;
        let name;
        for (k in names) {
          if (k.toLowerCase().indexOf('english') >= 0) name = names[k];
        }
        const track = {
          name,
          comparisonNumber: comparisonTotal++,
          number: total++,
          disc: Number.parseInt(i) + 1
        };
        newTracks.push(track);
      }
      comparisonTotal = 1;
    }

    // reads and temporarily saves image on file system
    const image = await request({
      url: data.picture_full || data.picture_small,
      encoding: 'binary'
    });
    fs.writeFileSync(`${folder}/temp_cover.png`, image, 'binary');

    // matches files to tracks obtained
    console.log(colors.grey(`\n  Updating tags according to data received from vgmdb.info:\n`))
    console.log(`  ${colors.yellow('ARTIST')}:    ${oldArtist}   ${colors.yellow('->')}   ${newArtist}`);
    console.log(`  ${colors.yellow('ALBUM')}:     ${oldAlbum}   ${colors.yellow('->')}   ${newAlbum}\n`);
    for (key in fileTags) {
      let found = false;
      for (track in newTracks) {
        if (
          newTracks[track].comparisonNumber == Number.parseInt(fileTags[key].trackNumber)
          && (!multiDisc || newTracks[track].disc == Number.parseInt(fileTags[key].partOfSet))
        ) {
          console.log(`  ${colors.blue('OK')}  ${fileTags[key].title} (#${Number.parseInt(fileTags[key].trackNumber)})  ${colors.yellow('->')}   ${newTracks[track].name} (#${newTracks[track].number})`);
          fileTags[key].title = newTracks[track].name;
          fileTags[key].artist = newArtist;
          fileTags[key].album = newAlbum;
          fileTags[key].image = `${folder}/temp_cover.png`;
          fileTags[key].trackNumber = newTracks[track].number;
          fileTags[key].partOfSet = 1;
          found = true;
          newTracks[track].found = true;
        }
      }
      if (!found) {
        console.log(`  ${colors.grey('NOT FOUND')}  ${fileTags[key].title} (#${Number.parseInt(fileTags[key].trackNumber)}) (disc #${Number.parseInt(fileTags[key].partOfSet)})`);
        fileTags[key].artist = newArtist;
        fileTags[key].album = newAlbum;
        fileTags[key].image = `${folder}/temp_cover.png`;
        fileTags[key].partOfSet = 1;
      }
    }
    for (track in newTracks) {
      if (!newTracks[track].found) {
        console.log(`  ${colors.grey('NOT USED')}  ${newTracks[track].name} (#${newTracks[track].number}) (comp #${newTracks[track].comparisonNumber}) (disc #${newTracks[track].disc})`);
      }
    }
    console.log('');

    // asks for confirmation and saves tags
    const read = await readFromTerminal('userConfirm', 'Press RETURN to update tags or type NO to cancel');
    if (read.userConfirm.toLowerCase != 'no' && read.userConfirm.toLowerCase != 'n') {
      for (key in fileTags) {
        const success = (id3.write(fileTags[key], key)) ? colors.green('SUCCESS') : `${colors.red('ERROR')}  `;
        console.log(`  ${success}  ${key}`);
      }
    }

    fs.unlinkSync(`${folder}/temp_cover.png`);
  } catch (e) {
    console.error(e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });

// vim:sw=2:et:sta
