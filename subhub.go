package main

import (
	"github.com/go-martini/martini"
)

func main() {
	m := martini.Classic()
	m.Get("/uploads/:channelId", func(params martini.Params) string {
		return "Hello " + params["channelId"]
	})
	m.Run()
}
