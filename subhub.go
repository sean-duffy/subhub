package main

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/stretchr/graceful"
)

var (
	listenPort = "8000"
)

func serveUploads(w http.ResponseWriter, r *http.Request) {
	pathSplit := strings.Split(r.URL.String(), "/")
	if len(pathSplit) < 3 {
		http.Error(w, "404 page not found", http.StatusNotFound)
		return
	}
	channelId := pathSplit[2]

	w.Header().Add("Content-Type", "text/html")
	io.WriteString(w, fmt.Sprintf("Hello, %s", channelId))
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
