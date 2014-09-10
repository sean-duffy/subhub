package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
	"github.com/sean-duffy/subhub/core"
	"github.com/stretchr/graceful"
)

var (
	listenPort = "8000"
)

func presentVideoQueryResults(w http.ResponseWriter, query string, args ...interface{}) {
	dbmap, err := core.InitDb()
	if err != nil {
		http.Error(w, "500: Could not connect to database", http.StatusInternalServerError)
	}
	defer dbmap.Db.Close()

	uploads, err := dbmap.Select(core.Video{}, query, args...)
	if err != nil {
		http.Error(w, "404: Page not found", http.StatusInternalServerError)
		return
	}

	uploadsJSON, err := json.Marshal(uploads)
	if err != nil {
		http.Error(w, "500: Error parsing database", http.StatusInternalServerError)
		return
	}

	_, err = w.Write(uploadsJSON)
	if err != nil {
		http.Error(w, "500: Error writing response", http.StatusInternalServerError)
	}
}

func serveUploads(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelId := vars["channelId"]

	w.Header().Add("Content-Type", "text/html")

	query := "select * from videos %s order by PublishedAt desc"

	if channelId == "all" {
		query = fmt.Sprintf(query, "")
	} else {
		query = fmt.Sprintf(query, "where ChannelId=?")
	}

	presentVideoQueryResults(w, query, channelId)
}

func addSeriesTracker(w http.ResponseWriter, r *http.Request) {
	dbmap, err := core.InitDb()
	if err != nil {
		http.Error(w, "500: Could not connect to database", http.StatusInternalServerError)
	}
	defer dbmap.Db.Close()

	r.ParseForm()

	channelId := r.Form["channelId"][0]
	trackerName := r.Form["trackerName"][0]
	seriesString := r.Form["seriesString"][0]

	newTracker := core.Tracker{
		Name:         trackerName,
		SeriesString: seriesString,
		ChannelId:    channelId,
	}

	err = dbmap.Insert(&newTracker)
	if err != nil {
		http.Error(w, "500: Could not connect to database", http.StatusInternalServerError)
	}
}

func serveSeries(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	trackerId := vars["channelId"]
	channelId := vars["channelId"]
	seriesString := vars["seriesString"]

	w.Header().Add("Content-Type", "text/html")

	seriesString = "%" + seriesString + "%"

	query := "select * from videos where Title like ? and ChannelId=? order by PublishedAt desc"

	presentVideoQueryResults(w, query, seriesString, channelId)
}

func main() {
	mux := mux.NewRouter()

	staticContent := http.FileServer(http.Dir("http"))

	mux.PathPrefix("/js/{_}").Handler(staticContent)
	mux.PathPrefix("/css/{_}").Handler(staticContent)
	mux.PathPrefix("/img/{_}").Handler(staticContent)
	mux.PathPrefix("/fonts/{_}").Handler(staticContent)
	mux.Path("/").Handler(staticContent)

	mux.Path("/uploads/{channelId:.{24}|all}").HandlerFunc(serveUploads)
	mux.Path("/addtracker").HandlerFunc(addSeriesTracker)
	mux.Path("/series/{trackerId}").HandlerFunc(serveSeries)

	graceful.Run(":"+listenPort, 10*time.Second, mux)
}
