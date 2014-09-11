// Some variables to remember state.
var currentChannelId, playlistId, nextPageToken, currentToken, scrollInterval, subscriptionListItems, subscriptionPageToken
var videoIdList = []
var topTenList

// This is run when authorisation is complete
function handleAPILoaded() {
    requestUserSubscriptionsList()
}

// Retrieve the users subscriptions
function requestUserSubscriptionsList(pageToken) {
    var requestOptions = {
        part: 'snippet',
        mine: true,
        maxResults: 50,
    }

    if (pageToken) {
        requestOptions.pageToken = pageToken
    } else {
        subscriptionListItems = []
    }

    var request = gapi.client.youtube.subscriptions.list(requestOptions)
    request.execute(function(response) {
        subscriptionListItems = subscriptionListItems.concat(response.items)
        subscriptionPageToken = response.nextPageToken

        if (subscriptionPageToken) {
            requestUserSubscriptionsList(subscriptionPageToken)
        } else {
            populateQuickSearch(subscriptionListItems)
        }
    })
}

// Populate the Series Trackers menu
function populateSeriesTrackers() {
    $('#trackerList').empty()
    $('#trackerList').html($("<li class='divider'></li>"))
    $('#trackerList').append($("<li><a id='newSeriesTracker'><span class='glyphicon glyphicon-plus'></span> New Tracker</a></li>"))
    if (currentChannelId != undefined) {
        $.get("listtrackers/" + currentChannelId, function(data) {
            trackers = JSON.parse(data)
            $.each(trackers, function(index, tracker) {
                var trackerItem = $('<li>')
                var trackerAnchor = $('<a>').attr('data-id', tracker.Id).text(tracker.Name)
                trackerAnchor.click(function() {
                    videoIdList = []
                    requestSeries($(this).attr('data-id'))
                    $('#videoContainer').empty()
                })
                $('#trackerList').prepend(trackerItem.append(trackerAnchor))
            })
        })
    }
}

// Send the API request to get uploads
function requestUploads(channelId) {
    populateSeriesTrackers()
    $.get("uploads/" + channelId, function(data) {
        uploads = JSON.parse(data)
        $.each(uploads, function(index, video) {
            videoIdList.push(video.Id)
        })
    })
}

// Get the details of a list of videos
function requestVideoContentDetails(videoIdString) {
    var requestOptions = {
        id: videoIdString,
        part: 'snippet,contentDetails'
    }

    var request = gapi.client.youtube.videos.list(requestOptions)
    request.execute(function(response) {
        var videoItems = response.items
        var itemRow = []
        $.each(videoItems, function(index, item) {
            itemRow.push(item)
            if (index % 4 == 3 || item == videoItems[videoItems.length - 1]) {
                createThumbnailRow(itemRow)
            }
        })
    })
}

// Render the thumbnails for a list of videos
function createThumbnailRow(videoItems) {
    var thumbnailRow = $('<div>')
    thumbnailRow.hide()
    thumbnailRow.addClass('row videoRow')

    jQuery.each(videoItems, function(index, item) {
        var videoBox = createVideoBox(item)
        thumbnailRow.append(videoBox)
    })

    $('#videoContainer').append(thumbnailRow)
    thumbnailRow.fadeIn()
}

// Create a box for a video
function createVideoBox(videoItem) {
    var id = videoItem.id
    var videoSnippet = videoItem.snippet
    var contentDetails = videoItem.contentDetails

    var li = $('<div>')
    li.addClass('col-md-3')

    var img = $('<img>')
    $(img).attr('src', videoSnippet.thumbnails.medium.url)

    var title = $('<a>')
    title.attr('href', 'http://www.youtube.com/watch?v=' + id)
    title.text(videoSnippet.title)

    var channelTitle = $('<a>')
    // TODO: Replace # with channel URL
    channelTitle.attr('href', '#')
    channelTitle.text(videoSnippet.channelTitle)
    var titleSpan = $('<span>').html('by ')
    titleSpan.append(channelTitle)

    var humanPublished = humaneDate(videoSnippet.publishedAt)
    var publishedSpan = $('<span>').text(humanPublished)
    publishedSpan.addClass('pull-right text-muted')

    var videoInfo = $('<small>')
    videoInfo.append(titleSpan)
    videoInfo.append(publishedSpan)

    var duration = formatDurationTime(contentDetails.duration)
    var videoTime = $('<span>')
    videoTime.addClass('video-time')
    videoTime.text(duration)

    var thumbnail = $('<div>')
    thumbnail.addClass('thumbnail')
    thumbnail.addClass('videoBox')
    thumbnail.append(img)
    thumbnail.append(videoTime)
    thumbnail.append($('<p>').append($('<strong>').append(title)).append($('<p>').append(videoInfo)))

    var videoBox = li.append(thumbnail)
    return videoBox
}

// Format a video's length into a human readable format
function formatDurationTime(duration) {

    var timeRegex = /PT(?:(\d\d?)H)?(?:(\d\d?)M)?(?:(\d\d?)S)?/

    match = timeRegex.exec(duration)
    match = match.slice(1)

    var textDuration = ''

    if (match[0] != undefined) {
        textDuration += match[0] + ':'
    }
    if (match[1] != undefined) {
        if (match[1].length < 2 && match[0] != undefined) {
            textDuration += '0'
        }
        textDuration += match[1] + ':'
    } else {
        textDuration += '0' + ':'
    }
    if (match[2] != undefined) {
        if (match[2].length < 2) {
            textDuration += '0'
        }
        textDuration += match[2]
    } else {
        textDuration += '00'
    }

    return textDuration
}

// Populate the quick search box with channels
function populateQuickSearch(subscriptionListItems) {

    var channelDatums = []

    jQuery.each(subscriptionListItems, function(index, item) {
        channelDatums.push({
            value: item.snippet.title,
            channelId: item.snippet.resourceId.channelId
        })
    })

    topTenList = channelDatums.slice(0, 10)

    $('.typeahead').typeahead({
        name: 'channels',
        local: channelDatums,
        template: '<p id={{channelId}}>{{value}}</p>',
        engine: Hogan
    })

    $(document).on('typeahead:selected', function(event, datum) {

        window.clearInterval(scrollInterval)

        $('#videoContainer').empty()
        currentChannelId = datum.channelId

        var channelName = datum.value
        var button = $('#channelSelector button')
        button.empty()
        button.append(channelName + ' ')
        button.append($('<span class="caret"></span>'))
        $('.typeahead').typeahead('setQuery', '')

        videoIdList = []
        requestUploads(currentChannelId)
        scrollInterval = setInterval(infiniteScroll, 500)
    })

    $('#newSeriesTracker').click(function() {
        $('#seriesTrackerModal').modal()
    })

    $('#createTracker').click(function() {
        $.post('/addtracker', {
            trackerName: $('#trackerName').val(),
            seriesString: $('#seriesString').val(),
            channelId: currentChannelId
        })
        $('#seriesTrackerModal').modal('hide')
    })

    $('.dropdown-menu #all-channels').click(function() {
        $('#videoContainer').empty()
        videoIdList = []
        requestUploads('all')
        scrollInterval = setInterval(infiniteScroll, 500)
    })

    $('.dropdown-menu #all-channels').click()
    $('#controlRow').show()
}

// Load the next page of videos
function nextPage() {
    if (videoIdList.length > 0) {
        var videoIdString = ""
        for (var i = 0; i < 4; i++) {
            item = videoIdList.shift()
            if (item == undefined) {
                break
                clearInterval(scrollInterval)
            } else {
                videoIdString += ',' + item
            }
        }
        requestVideoContentDetails(videoIdString)
    }
}

// Load more videos when the user reaches the bottom of the page
function infiniteScroll() {
    var totalHeight, currentScroll, visibleHeight

    if (document.documentElement.scrollTop) {
        currentScroll = document.documentElement.scrollTop
    } else {
        currentScroll = document.body.scrollTop
    }

    var totalHeight = document.body.offsetHeight
    var visibleHeight = document.documentElement.clientHeight

    if (totalHeight <= currentScroll + visibleHeight + totalHeight * 0.1) {
        nextPage()
    }
}
