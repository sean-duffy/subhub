package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/coopernurse/gorp"
	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
	"github.com/sean-duffy/subhub/core"
	"github.com/stretchr/graceful"
)

var (
	listenPort = "8000"
)

func presentVideoQueryResults(w http.ResponseWriter, query string, args ...interface{}) {
	db, err := sql.Open("sqlite3", os.ExpandEnv("db.sqlite"))
	if err != nil {
		http.Error(w, "500: Could not connect to database", http.StatusInternalServerError)
		return
	}

	dbmap := &gorp.DbMap{Db: db, Dialect: gorp.SqliteDialect{}}

	uploads, err := dbmap.Select(core.Video{}, query, args...)
	if err != nil {
		http.Error(w, "404: Page not found", http.StatusInternalServerError)
		fmt.Printf("%v\n", err)
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

func serveSeries(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
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

	mux.PathPrefix("/js").Handler(staticContent)
	mux.PathPrefix("/css").Handler(staticContent)
	mux.PathPrefix("/img").Handler(staticContent)
	mux.PathPrefix("/fonts").Handler(staticContent)
	mux.Path("/").Handler(staticContent)

	mux.Path("/uploads/{channelId:.{24}|all}").HandlerFunc(serveUploads)
	mux.Path("/series/{channelId:.{24}}/{seriesString}").HandlerFunc(serveSeries)

	graceful.Run(":"+listenPort, 10*time.Second, mux)
}
