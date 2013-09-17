// Some variables to remember state.
var channelId, playlistId, nextPageToken, currentToken, scrollInterval

// Once the api loads call a function to get the uploads playlist id.
function handleAPILoaded() {
    channelId = 'UCD4INvKvy83OXwAkRjaQKtw'
    requestUserUploadsPlaylistId(channelId)
    requestUserSubscriptionsList()
    scrollInterval = setInterval(infiniteScroll, 500)
}

//Retrieve the uploads playlist id.
function requestUserUploadsPlaylistId(channelId) {
    var request = gapi.client.youtube.channels.list({
        id: channelId,
        part: 'contentDetails'
    })

    request.execute(function(response) {
        playlistId = response.result.items[0].contentDetails.relatedPlaylists.uploads
        requestVideoPlaylist(playlistId)
    })
}

function requestUserSubscriptionsList() {
    var request = gapi.client.youtube.subscriptions.list({
        part: 'snippet',
        mine: true,
        maxResults: 9
    })

    request.execute(function(response) {
        var subscriptionListItems = response.items
        populateChannelDropdown(subscriptionListItems)
    })
}

// Retrieve a playist of videos.
function requestVideoPlaylist(playlistId, pageToken) {

    var loadingRow = $('<div>')
    loadingRow.addClass('row loading')
    loadingRow.append('<img src="img/loader.gif">')
    $('#videoContainer').append(loadingRow)

    var requestOptions = {
        playlistId: playlistId,
        part: 'snippet',
        maxResults: 4
    }

    if (pageToken) {
        requestOptions.pageToken = pageToken
    }

    var request = gapi.client.youtube.playlistItems.list(requestOptions)
    request.execute(function(response) {
        var playlistItems = response.result.items
        nextPageToken = response.result.nextPageToken

        if (playlistItems) {
            videoIdList = ''

            jQuery.each(playlistItems, function(index, item) {
                videoIdList += ',' + item.snippet.resourceId.videoId
            })

            requestVideoContentDetails(videoIdList)
        } else {
            $('#video-container').html('No videos available.')
        }

    })
}

function requestVideoContentDetails(videoIdList) {

    var requestOptions = {
        id: videoIdList,
        part: 'snippet,contentDetails'
    }

    var request = gapi.client.youtube.videos.list(requestOptions)
    request.execute(function(response) {
        var videoItems = response.items

        var itemRow = []
        jQuery.each(videoItems, function(index, item) {

            itemRow.push(item)

            if (index % 4 == 3) {
                createThumbnailRow(itemRow)
                itemRow = []
            }
        })
    })
}

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

// Create a thumbnail for a video snippet.
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
    }
    textDuration += match[2]

    return textDuration

}

function populateChannelDropdown(subscriptionListItems) {

    var channelList = $('#channelList').detach()

    jQuery.each(subscriptionListItems, function(index, item) {
        var link = $('<a>')
        link.text(item.snippet.title)
        link.attr('id', item.snippet.resourceId.channelId)
        channelList.append($('<li>').html(link))
    })

    $('#channelSelector').append(channelList)

    $('#channelList a').on('click', function(event) {
        window.clearInterval(scrollInterval)
        $('#videoContainer').empty()
        channelId = $(this).attr('id')
        var channelName = $(this).text()
        var button = $('#channelSelector button')
        button.empty()
        button.append(channelName + ' ')
        button.append($('<span class="caret"></span>'))
        requestUserUploadsPlaylistId(channelId)
        scrollInterval = setInterval(infiniteScroll, 500)
    })

    $(document).on('scroll', infiniteScroll)
}

function nextPage() {
    if (currentToken != nextPageToken) {
        requestVideoPlaylist(playlistId, nextPageToken)
    }
    currentToken = nextPageToken
}

function infiniteScroll() {
    var totalHeight, currentScroll, visibleHeight;

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