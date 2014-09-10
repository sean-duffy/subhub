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
	var pageMaxResults int64
	var nextPageToken string

	baseCall := service.Subscriptions.List("snippet").Mine(true)
	channelIds := []string{}
	firstPage := true

	for (nextPageToken != "" || firstPage) && maxResults > 0 {
		if maxResults > 50 {
			pageMaxResults = 50
		} else {
			pageMaxResults = maxResults
		}
		maxResults -= pageMaxResults

		call := baseCall.MaxResults(pageMaxResults).PageToken(nextPageToken)

		response, err := call.Do()
		if err != nil {
			return nil, err
		}

		nextPageToken = response.NextPageToken

		for _, subscription := range response.Items {
			channelIds = append(channelIds, subscription.Snippet.ResourceId.ChannelId)
		}

		firstPage = false
	}

	return channelIds, nil
}

// ChannelDetails returns the channel specified by channelId, including
// the snippet and contentDetails.
func ChannelDetails(service *youtube.Service, channelId string) (*youtube.Channel, error) {
	call := service.Channels.List("snippet,contentDetails,statistics").Id(channelId)

	response, err := call.Do()
	if err != nil {
		return nil, err
	}

	return response.Items[0], nil
}

// PlaylistVideoIds returns a list of the IDs of the videos in the playlist specified by
// playlistId. The maximum number of video IDs returned is specified by maxResults.
func PlaylistVideoIds(service *youtube.Service, playlistId string, maxResults int64) ([]string, error) {
	var pageMaxResults int64
	var nextPageToken string

	baseCall := service.PlaylistItems.List("snippet").PlaylistId(playlistId)
	videoIds := []string{}
	firstPage := true

	for (nextPageToken != "" || firstPage) && maxResults > 0 {
		if maxResults > 50 {
			pageMaxResults = 50
		} else {
			pageMaxResults = maxResults
		}
		maxResults -= pageMaxResults

		call := baseCall.MaxResults(pageMaxResults).PageToken(nextPageToken)

		response, err := call.Do()
		if err != nil {
			return []string{}, err
		}

		nextPageToken = response.NextPageToken

		for _, playlistItem := range response.Items {
			videoIds = append(videoIds, playlistItem.Snippet.ResourceId.VideoId)
		}

		firstPage = false
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
	channel, err := ChannelDetails(service, channelId)
	if err != nil {
		log.Fatalf("Could not get channel details: %v", err)
	}

	playlistId := channel.ContentDetails.RelatedPlaylists.Uploads

	log.Println("Getting video IDs for", channel.Snippet.Title)

	videoIds, err := PlaylistVideoIds(service, playlistId, 3000)
	if err != nil {
		log.Fatalf("Could not get video IDs from playlist: %v", err)
	}

	log.Println("Getting video details for", channel.Snippet.Title)

	var currentChannelStored int64
	var count int64

	for _, videoId := range videoIds {
		count, err = dbmap.SelectInt("select count(*) from videos where Id=?", videoId)
		if err != nil {
			return err
		}
		if count == 0 {
			video, err := VideoSnippet(service, videoId)
			if err != nil {
				return err
			}

			publishedAt, err := time.Parse(time.RFC3339Nano, video.Snippet.PublishedAt)
			if err != nil {
				return err
			}

			videoRecord := Video{video.Id, video.Snippet.ChannelId, publishedAt}
			err = dbmap.Insert(&videoRecord)
			if err != nil {
				return err
			}

			currentChannelStored, err = dbmap.SelectInt("select Stored from channels where Id=?", channelId)
			if err != nil {
				return err
			}

			if uint64(currentChannelStored) == channel.Statistics.VideoCount {
				break
			}
		}
	}

	stored, err := dbmap.SelectInt("select count(*) from videos where ChannelId=?", channel.Id)
	if err != nil {
		return err
	}

	log.Printf("Saved %v videos", stored)

	channelRecord := Channel{channel.Id, channel.Snippet.Title, channel.Statistics.VideoCount, uint64(stored), time.Now()}
	count, err = dbmap.SelectInt("select count(*) from channels where Id=?", channel.Id)
	if count == 0 {
		err = dbmap.Insert(&channelRecord)
		if err != nil {
			return err
		}
	} else {
		_, err = dbmap.Update(&channelRecord)
		if err != nil {
			return err
		}
	}

	return nil
}

// Video is the database model for videos
type Video struct {
	Id          string
	ChannelId   string
	PublishedAt time.Time
}

// Channel is the database model for channels
type Channel struct {
	Id          string
	Title       string
	Uploads     uint64
	Stored      uint64
	LastUpdated time.Time
}

// initDb opens the database and creates the videos table if necessary.
func initDb() (*gorp.DbMap, error) {
	db, err := sql.Open("sqlite3", os.ExpandEnv("../db.sqlite"))
	if err != nil {
		return nil, err
	}

	dbmap := &gorp.DbMap{Db: db, Dialect: gorp.SqliteDialect{}}
	dbmap.AddTableWithName(Video{}, "videos").SetKeys(false, "Id")
	dbmap.AddTableWithName(Channel{}, "channels").SetKeys(false, "Id")

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

	userSubscriptionIds, err := UserSubscriptionIds(service, 3000)
	if err != nil {
		log.Fatalf("Could not get user subscriptions: %v", err)
	}

	for _, channelId := range userSubscriptionIds {
		err = saveUploads(dbmap, service, channelId)
		if err != nil {
			log.Fatalf("Could not save channel uploads: %v", err)
		}
	}
}
