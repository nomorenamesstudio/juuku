import type { Song } from './api';

/**
 * "Various Artists" is the compilation's album artist, not a credit: showing it beside
 * every track of a compilation would be noise, and the track's own artist is the useful
 * name there.
 */
const VARIOUS = /^various\s+artists?$/i;

/**
 * Who to show and where to link, for one track. A featured artist often has no albums of
 * its own, so its page is a dead end — the album artist is the one that leads somewhere,
 * with the collaborator named beside it.
 */
export function credit(track: Pick<Song, 'artist' | 'artistId' | 'albumArtist' | 'albumArtistId'>) {
  const albumArtist = track.albumArtist?.trim();
  const artist = track.artist.trim();
  if (!albumArtist || VARIOUS.test(albumArtist) || albumArtist.toLowerCase() === artist.toLowerCase()) {
    return { primary: artist, primaryId: track.artistId, secondary: null as string | null };
  }
  return { primary: albumArtist, primaryId: track.albumArtistId, secondary: artist === albumArtist ? null : artist };
}
