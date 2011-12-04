var Bot = require('ttapi');
var DB = require('./db.js');
var adminId = process.env.TTFMBOT_ADMIN_ID;
var currentPlayId;
var ttfm = new Bot(
    process.env.TTFMBOT_USER_AUTH,
    process.env.TTFMBOT_USER_ID,
    process.env.TTFMBOT_ROOM_ID);

ttfm.on('newsong', function(data) {
    if (data.success) {
        ttfm.getProfile(data.room.metadata.current_dj, function(profile) {
            if (profile) {
                var isAdmin = false;
                if (profile.userid == adminId) { isAdmin = true; }
                DB.DJ.Add(profile.userid, profile.name, profile.created, isAdmin, function(err, dj) {
                    LogError(err);
                    var songTT = data.room.metadata.current_song;
                    DB.Artist.Add(songTT.metadata.artist, function(err, artist) {
                        LogError(err);
                        if (artist) {
                            DB.Song.Add(
                                songTT.metadata.album,
                                artist,
                                songTT.metadata.coverart,
                                songTT.metadata.song,
                                function(err, song) {
                                    LogError(err);
                                    if (dj && song) {
                                        DB.Play.Add(
                                            dj,
                                            data.room.metadata.downvotes,
                                            data.room.metadata.listeners,
                                            song,
                                            songTT.starttime,
                                            data.room.metadata.upvotes,
                                            function(err, play) {
                                                LogError(err);
                                                currentPlayId = play._id;
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    });
                });
            }
        });
    }
});

ttfm.on('speak', function(data) {
    if (data) {
        DB.DJ.IsAdmin(data.userid, function(err, admin) {
            LogError(err);
            if (data.userid == adminId || admin) {
                var result = data.text.match(/^\/(.*?)( .*)?$/);
                if (result) {
                    // break out the command and parameter if one exists
                    var command = result[1].trim().toLowerCase();
                    var param = '';
                    if (result.length == 3 && result[2]) {
                        param = result[2].trim().toLowerCase();
                    }
                    // handle valid commands
                    switch(command) {
                        // admin management
                        case 'sa':
                        case 'setadmin':
                            SetAdmin(param);
                            break;
                        case 'da':
                        case 'deladmin':
                            DeleteAdmin(param);
                            break;

                        // queue management
                        case 'snag':
                            ttfm.snag();
                            break;

                        // voting
                        case 'a':
                        case 'awesome':
                            ttfm.vote('up');
                            break;
                        case 'l':
                        case 'lame':
                            ttfm.vote('down');
                            break;
                    }
                }
            }
        });
    }
});

function DeleteAdmin(name) {
    ttfm.roomInfo(true, function(info) {
        if (info.users) {
            for (i in info.users) {
                var u = info.users[i];
                if (u.name.toLowerCase() == name) {
                    DB.DJ.Add(u.userid, u.name, u.created, false, function(err, dj) {
                        if (err) {
                            LogError(err);
                        } else {
                            ttfm.speak(u.name + ' is no longer an admin.');
                        }
                    });
                    return;
                }
            }
        }
        LogError('Unable to locate user Id for ' + name + '.');
    });
}

function SetAdmin(name) {
    ttfm.roomInfo(true, function(info) {
        if (info.users) {
            for (i in info.users) {
                var u = info.users[i];
                if (u.name.toLowerCase() == name) {
                    DB.DJ.Add(u.userid, u.name, u.created, true, function(err, dj) {
                        if (err) {
                            LogError(err);
                        } else {
                            ttfm.speak(u.name + ' added as an admin.');
                        }
                    });
                    return;
                }
            }
        }
        LogError('Unable to locate user Id for ' + name + '.');
    });
}

function LogError(err) {
    if (err) {
        ttfm.speak(err);
    }
}