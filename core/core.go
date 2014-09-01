package core

import (
	"database/sql"
	"log"
	"os"
	"time"

	"code.google.com/p/google-api-go-client/youtube/v3"
	"github.com/coopernurse/gorp"
	_ "github.com/mattn/go-sqlite3"
)

// UserSubscriptionIds returns a list of the IDs for the user's subscribed
// channels. The maximum number of channels returned is specified by maxResults.
func UserSubscriptionIds(service *youtube.Service, maxResults int64) ([]string, error) {
	call := service.Subscriptions.List("snippet").Mine(true).MaxResults(maxResults)

	response, err := call.Do()
	if err != nil {
		return nil, err
	}

	channelIds := []string{}
	for _, subscription := range response.Items {
		channelIds = append(channelIds, subscription.Snippet.ResourceId.ChannelId)
	}

	return channelIds, nil
}

// ChannelUploadsPlaylistId returns the ID of the playlist containing the uploads for
// the channel specified by channelId.
func ChannelUploadsPlaylistId(service *youtube.Service, channelId string) (string, error) {
	call := service.Channels.List("contentDetails").Id(channelId)

	response, err := call.Do()
	if err != nil {
		return "", err
	}

	return response.Items[0].ContentDetails.RelatedPlaylists.Uploads, nil
}

// PlaylistVideoIds returns a list of the IDs of the videos in the playlist specified by
// playlistId. The maximum number of video IDs returned is specified by maxResults.
func PlaylistVideoIds(service *youtube.Service, playlistId string, maxResults int64) ([]string, error) {
	call := service.PlaylistItems.List("snippet").MaxResults(maxResults).PlaylistId(playlistId)

	response, err := call.Do()
	if err != nil {
		return []string{}, err
	}

	videoIds := []string{}
	for _, playlistItem := range response.Items {
		videoIds = append(videoIds, playlistItem.Snippet.ResourceId.VideoId)
	}

	return videoIds, nil
}

// VideoSnippet returns the video with the ID videoId, with the snippet part included.
func VideoSnippet(service *youtube.Service, videoId string) (*youtube.Video, error) {
	call := service.Videos.List("snippet").Id(videoId)

	response, err := call.Do()
	if err != nil {
		return nil, err
	}

	return response.Items[0], nil
}

// saveUploads saves the details of the uploads belonging to the channel specified by
// channelId to the database.
func saveUploads(dbmap *gorp.DbMap, service *youtube.Service, channelId string) error {
	playlistId, err := ChannelUploadsPlaylistId(service, channelId)
	if err != nil {
		log.Fatalf("Could not get uploads playlist ID: %v", err)
	}

	videoIds, err := PlaylistVideoIds(service, playlistId, 50)
	if err != nil {
		log.Fatalf("Could not get video IDs from playlist: %v", err)
	}

	for _, videoId := range videoIds {
		video, err := VideoSnippet(service, videoId)
		if err != nil {
			return err
		}

		publishedAt, err := time.Parse(time.RFC3339Nano, video.Snippet.PublishedAt)
		if err != nil {
			return err
		}

		videoRecord := Video{video.Id, video.Snippet.ChannelId, publishedAt}
		count, err := dbmap.SelectInt("select count(*) from videos where Id=?", video.Id)
		if count == 0 {
			err = dbmap.Insert(&videoRecord)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

type Video struct {
	Id          string
	ChannelId   string
	PublishedAt time.Time
}

// initDb opens the database and creates the videos table if necessary.
func initDb() (*gorp.DbMap, error) {
	db, err := sql.Open("sqlite3", os.ExpandEnv("../db.sqlite"))
	if err != nil {
		return nil, err
	}

	dbmap := &gorp.DbMap{Db: db, Dialect: gorp.SqliteDialect{}}
	dbmap.AddTableWithName(Video{}, "videos").SetKeys(false, "Id")

	err = dbmap.CreateTablesIfNotExists()
	if err != nil {
		return nil, err
	}

	return dbmap, nil
}

func GetData() {
	client, err := buildOAuthHTTPClient(youtube.YoutubeReadonlyScope)
	if err != nil {
		log.Fatalf("Error building OAuth client: %v", err)
	}

	service, err := youtube.New(client)
	if err != nil {
		log.Fatalf("Error creating YouTube client: %v", err)
	}

	dbmap, err := initDb()
	if err != nil {
		log.Fatalf("Could not initialise database: %v", err)
	}
	defer dbmap.Db.Close()

	userSubscriptionIds, err := UserSubscriptionIds(service, 5)

	for _, channelId := range userSubscriptionIds {
		err = saveUploads(dbmap, service, channelId)
		if err != nil {
			log.Fatalf("Could not save channel uploads: %v", err)
		}
	}
}