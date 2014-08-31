// Some variables to remember state.
var currentChannelId, playlistId, nextPageToken, currentToken, scrollInterval, subscriptionListItems, subscriptionPageToken
var topTenList

function handleAPILoaded() {
    requestUserSubscriptionsList()
    scrollInterval = setInterval(infiniteScroll, 500)
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

function requestUploads(channelId) {
    $.get("uploads/" + channelId, function(data) {
        uploads = JSON.parse(data)
        videoIdList = ""
        $.each(uploads, function(index, video) {
            videoIdList += "," + video.Id
        })
        console.log(videoIdList)
        requestVideoContentDetails(videoIdList)
    })
}

// Get the details of a list of videos
function requestVideoContentDetails(videoIdList) {
    var requestOptions = {
        id: videoIdList,
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
                itemRow = []
            }
        })
    })
}

// Render the thumbnails for a list of videos
function createThumbnailRow(videoItems) {
    var thumbnailRow = $('<div>')
    thumbnailRow.addClass('row videoRow')

    jQuery.each(videoItems, function(index, item) {
        var videoBox = createVideoBox(item)
        thumbnailRow.append(videoBox)
    })

    $('.row .loading').remove()
    $('#videoContainer').append(thumbnailRow)
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

    var timeEx = /PT(?:(\d\d?)H)?(?:(\d\d?)M)?(\d\d?)S/

    match = timeEx.exec(duration)
    match = match.slice(1)
    for (i in match) {
        n = match[i]
        if (n != undefined && n.length < 2) {
            match[i] += '0'
        }
    }

    var textDuration = ''
    if (match[0] != undefined) {
        textDuration += match[0] + ':'
    }
    if (match[1] != undefined) {
        textDuration += match[1] + ':'
    } else {
        textDuration += '0:'
    }
    textDuration += match[2]

    return textDuration
}

function populateChannelDropdown(subscriptionListItems) {

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

        requestUploads(currentChannelId)
        scrollInterval = setInterval(infiniteScroll, 500)
    })

}

// Load the next page of videos
function nextPage() {
    if (currentToken != nextPageToken) {
        requestVideoPlaylist(playlistId, nextPageToken)
    }
    currentToken = nextPageToken
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

    if (totalHeight <= currentScroll + visibleHeight && nextPageToken) {
        nextPage()
    }
}
