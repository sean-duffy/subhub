package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"
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

func serveUploads(w http.ResponseWriter, r *http.Request) {
	pathSplit := strings.Split(r.URL.String(), "/")
	if len(pathSplit) < 3 {
		http.Error(w, "404: Page not found", http.StatusNotFound)
		return
	}
	channelId := pathSplit[2]

	w.Header().Add("Content-Type", "text/html")

	db, err := sql.Open("sqlite3", os.ExpandEnv("db.sqlite"))
	if err != nil {
		http.Error(w, "500: Could not connect to database", http.StatusInternalServerError)
		return
	}

	dbmap := &gorp.DbMap{Db: db, Dialect: gorp.SqliteDialect{}}

	uploads, err := dbmap.Select(core.Video{}, "select * from videos where ChannelId=? order by PublishedAt desc", channelId)
	if err != nil {
		http.Error(w, "500: Database error", http.StatusInternalServerError)
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

func main() {
	mux := mux.NewRouter()

	staticContent := http.FileServer(http.Dir("http"))

	mux.PathPrefix("/js").Handler(staticContent)
	mux.PathPrefix("/css").Handler(staticContent)
	mux.PathPrefix("/img").Handler(staticContent)
	mux.PathPrefix("/fonts").Handler(staticContent)
	mux.Path("/").Handler(staticContent)

	mux.PathPrefix("/uploads").HandlerFunc(serveUploads)

	graceful.Run(":"+listenPort, 10*time.Second, mux)
}
