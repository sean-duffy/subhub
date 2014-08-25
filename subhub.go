package main

import (
	_ "fmt"
	"log"

	"code.google.com/p/google-api-go-client/youtube/v3"
)

func main() {
	client, err := buildOAuthHTTPClient(youtube.YoutubeReadonlyScope)
	if err != nil {
		log.Fatalf("Error building OAuth client: %v", err)
	}

	service, err := youtube.New(client)
	if err != nil {
		log.Fatalf("Error creating YouTube client: %v", err)
	}

	call := service.Subscriptions.List("snippet").Mine(true)

}
