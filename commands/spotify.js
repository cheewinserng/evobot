const i18n = require("../util/i18n");
const { play } = require("../include/play");
const ytdl = require("ytdl-core");
const YouTubeAPI = require("simple-youtube-api");
const scdl = require("soundcloud-downloader").default;
const https = require("https");
const { YOUTUBE_API_KEY, SOUNDCLOUD_CLIENT_ID, DEFAULT_VOLUME } = require("../util/Util");
const youtube = new YouTubeAPI(YOUTUBE_API_KEY);
const { Spotify } = require('simple-spotify');
const YoutubeMusicApi = require('youtube-music-api')

// 
//var s = new Spotify();

module.exports = {
  name: "spotify",
  cooldown: 5,
  aliases: ["sp"],
  description: i18n.__("spotify.description"),
  async execute(message, args) {
    //check member channel
    const { channel } = message.member.voice;
    const serverQueue = message.client.queue.get(message.guild.id);
    if (!channel) return message.reply(i18n.__("play.errorNotChannel")).catch(console.error);

    //only can be alter of is same channel or bot not in any channel
    if (serverQueue && channel !== message.guild.me.voice.channel)
      return message
        .reply(i18n.__mf("play.errorNotInSameChannel", { user: message.client.user }))
        .catch(console.error);

    if (!args.length)
      return message
        .reply(i18n.__mf("play.usageReply", { prefix: message.client.prefix }))
        .catch(console.error);

    const permissions = channel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT")) return message.reply(i18n.__("play.missingPermissionConnect"));
    if (!permissions.has("SPEAK")) return message.reply(i18n.__("play.missingPermissionSpeak"));

    const search = args.join(" ");

    //https://open.spotify.com/playlist/37i9dQZF1E4nCrZFTegWCl
    //https://open.spotify.com/track/08YwAPnX8sygJUXG9rvhDv?si=a7d6f56ff2dc43ff&nd=1
    //http://spoti.fi/NkSr2b

    const spotifyLinkPattern = /^(https:\/\/open.spotify.com)/gi;
    const spotifyTrackPattern = /^(https:\/\/open.spotify.com\/track\/)/gi;
    const spotifyPlaylistPattern = /^(https:\/\/open.spotify.com\/playlist\/)/gi;

    const url = args[0];
    const spotifyUrlValid = spotifyLinkPattern.test(url);

    let songInfo = null;
    let song = null;


    const queueConstruct = {
      textChannel: message.channel,
      channel,
      connection: null,
      songs: [],
      loop: false,
      volume: DEFAULT_VOLUME,
      muted: false,
      playing: true
    };


    if (spotifyUrlValid) {

      const api = new YoutubeMusicApi();
      try {
        await api.initalize();
      }
      catch {
        console.error(error);
        return message.reply(error.message).catch(console.error);
      }

      if (spotifyTrackPattern.test(url)) {
        const spotify = new Spotify();
        const track = await spotify.track(url);
        let search = track.name;

        for (let x = 0; x < track.artists.length; x++) {
          search += ' ' + track.artists[x].name;
        }
        try {
          let results = await api.search(search, "song");
          if (!results.content.length) {
            message.reply(i18n.__("play.songNotFound")).catch(console.error);
            return;
          }

          songurl = 'https://www.youtube.com/watch?v=' + results.content[0].videoId;
          song = {
            title: results.content[0].name,
            url: songurl,
            duration: results.content[0].duration / 1000
          };
        } catch (error) {
          console.error(error);
          return message.reply(error.message).catch(console.error);
        }

        if (serverQueue) {
          serverQueue.songs.push(song);
          return serverQueue.textChannel
            .send(i18n.__mf("play.queueAdded", { title: song.title, author: message.author }))
            .catch(console.error);
        }
      } else if (spotifyPlaylistPattern.test(url)) {

        const spotify = new Spotify();
        const playlist = await spotify.playlist(url, true);

        if (playlist) {
          for (const item of playlist.tracks.items) {

            let track = item.track;
            let search = track.name;
            for (let x = 0; x < track.artists.length; x++) {
              search += ' ' + track.artists[x].name;
            }

            try {
              let results = await api.search(search, "song");
              if (!results.content.length) {
                message.reply(i18n.__("play.songNotFound")).catch(console.error);
                return;
              }

              songurl = 'https://www.youtube.com/watch?v=' + results.content[0].videoId;
              song = {
                title: results.content[0].name,
                url: songurl,
                duration: results.content[0].duration / 1000
              };
            } catch (error) {
              console.error(error);
              return message.reply(error.message).catch(console.error);
            }

            if (serverQueue) {
              serverQueue.songs.push(song);
            } else {
              queueConstruct.songs.push(song);
              message.client.queue.set(message.guild.id, queueConstruct);
            }

          }
          if (!serverQueue) {
            try {
              queueConstruct.connection = await channel.join();
              await queueConstruct.connection.voice.setSelfDeaf(true);
              play(queueConstruct.songs[0], message);
            } catch (error) {
              console.error(error);
              message.client.queue.delete(message.guild.id);
              await channel.leave();
              return message.channel.send(i18n.__mf("play.cantJoinChannel", { error: error })).catch(console.error);
            }
          }
          


        }
        return;
      }
    }

    /*
          if (serverQueue) {
            serverQueue.songs.push(song);
            return serverQueue.textChannel
              .send(i18n.__mf("play.queueAdded", { title: song.title, author: message.author }))
              .catch(console.error);
          }
      */
    queueConstruct.songs.push(song);
    message.client.queue.set(message.guild.id, queueConstruct);

    try {
      queueConstruct.connection = await channel.join();
      await queueConstruct.connection.voice.setSelfDeaf(true);
      play(queueConstruct.songs[0], message);
    } catch (error) {
      console.error(error);
      message.client.queue.delete(message.guild.id);
      await channel.leave();
      return message.channel.send(i18n.__mf("play.cantJoinChannel", { error: error })).catch(console.error);
    }
  }
}

