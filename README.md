# VGMdb.info Tagger

Collect tags from VGMdb.ingo (mirror of VGMdb.net that offers a JSON API), matches to files in a single folder and updates their tags and cover image.

## Usage

`node main.js -u URL FOLDER`

Example:

`node main.js -u http://vgmdb.info/album/68942 /home/user/Music/Folder`

## Details

 - Tags updated: Artist, Album, Title, Track #, Disc #, Cover Art. Other existing tags are preserved;
 - Files need to have their Track # ID3 tag set up in order to be matched;
 - Albums with multiple CDs require the Disc # ID3 tag set up in order to be matched;
 - Cover Art is always overwritten;
 - File names are neither used nor changed by this script.

## TODO

 - Add file name logic when files do not have any ID3 tags at all;
 - Add vgmdb.info search inside the script;
 - Update more ID3 tags with data received;
 - Bulk analysis of several albums.
