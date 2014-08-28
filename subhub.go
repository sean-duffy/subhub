package main

import (
	"database/sql"
	"log"
	"os"

	"code.google.com/p/google-api-go-client/youtube/v3"
	_ "github.com/mattn/go-sqlite3"
)

// UserSubscriptionIds returns a list of ChannelIds belonging
// to the user's subscribed channels
func UserSubscriptionIds(service *youtube.Service) ([]string, error) {
	call := service.Subscriptions.List("snippet").Mine(true).MaxResults(2)

	response, err := call.Do()
	if err != nil {
		return nil, err
	}

	channelIds := []string{}
	for _, subscription := range response.Items {
		channelIds = append(channelIds, subscription.Snippet.ChannelId)
	}

	return channelIds, nil
}

func ChannelUploadsPlaylistId(service *youtube.Service, channelId string) (string, error) {
	call := service.Channels.List("contentDetails").Id(channelId)

	response, err := call.Do()
	if err != nil {
		return "", err
	}

	return response.Items[0].ContentDetails.RelatedPlaylists.Uploads, nil
}

func PlaylistVideoIds(service *youtube.Service, playlistId string) ([]string, error) {
	call := service.PlaylistItems.List("snippet").MaxResults(4).PlaylistId(playlistId)

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

func main() {
	client, err := buildOAuthHTTPClient(youtube.YoutubeReadonlyScope)
	if err != nil {
		log.Fatalf("Error building OAuth client: %v", err)
	}

	service, err := youtube.New(client)
	if err != nil {
		log.Fatalf("Error creating YouTube client: %v", err)
	}

	db, err := sql.Open("sqlite3", os.ExpandEnv("$HOME/db.sqlite"))
	if err != nil {
		log.Fatalf("Could not open database: %v", err)
	}

	err = db.QueryRow(`
    CREATE TABLE IF NOT EXISTS
    videos (
        id integer primary key,
        publishedAt datetime,
        channelId integer)
    `).Scan()
	if err != nil && err != sql.ErrNoRows {
		log.Fatalf("Could not create table: %v", err)
	}

	userSubscriptionIds, err := UserSubscriptionIds(service)

	for _, channelId := range userSubscriptionIds {
		playlistId, err := ChannelUploadsPlaylistId(service, channelId)
		if err != nil {
			log.Fatalf("Could not get uploads playlist ID: %v", err)
		}

		log.Printf("%v\n", playlistId)
	}
}
