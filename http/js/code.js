// Some variables to remember state.
var currentChannelId, nextPageToken, scrollInterval, subscriptionListItems, subscriptionPageToken
var videoIdList = []
var editingTrackerId

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
            populateChannelSearch(subscriptionListItems)
        }
    })
}

// Populate the Series Trackers menu
function populateSeriesTrackers() {
    $('a[data-id]').parent().remove()
    $('#trackerList .divider').remove()
    if (currentChannelId != undefined) {
        $.get("listtrackers/" + currentChannelId, function(data) {
            trackers = JSON.parse(data)

            if (trackers.length > 0) {
                $('#trackerList').prepend($("<li class='divider'></li>"))
            }

            $.each(trackers, function(index, tracker) {
                var trackerItem = $('<li>')
                var nameSpan = $('<span>').text(tracker.Name).addClass('nameSpan')
                var trackerAnchor = $('<a>').attr('data-id', tracker.Id).html(nameSpan)

                trackerAnchor.click(function() {
                    videoIdList = []
                    requestSeries($(this).attr('data-id'))
                    $('#videoContainer').empty()
                })

                $('#trackerList').prepend(trackerItem.append(trackerAnchor))
                trackerAnchor.prepend($("<span class='glyphicon glyphicon-pencil editTracker'></span>"))
            })

            $('.editTracker').hover(function() {
                $(this).parent().css('color', '#333333')
                $(this).parent().css('background-color', 'white')
            }, function() {
                $(this).parent().css('color', '')
                $(this).parent().css('background-color', '')
            })

            $('.editTracker').click(function(e) {
                e.stopPropagation()

                deleteButton = "<button type='button' class='btn btn-danger' id='deleteTracker'>Delete Tracker</button>"
                $('#createTracker').before($(deleteButton))
                $('#deleteTracker').click(function() {
                    $.post('/deletetracker', {
                        trackerId: trackerId
                    })
                    $('#seriesTrackerModal').modal('hide')
                    populateSeriesTrackers()
                })

                $('#createTracker').text('Update Tracker')

                var trackerId = $(this).parent().attr('data-id')
                $.get("listtrackers/" + currentChannelId, function(data) {
                    trackers = JSON.parse(data)
                    $.each(trackers, function(index, tracker) {
                        if (tracker['Id'] == trackerId) {
                            $('#trackerName').val(tracker['Name'])
                            $('#seriesString').val(tracker['SeriesString'])
                            editingTrackerId = trackerId
                            $('#seriesTrackerModal').modal()
                        }
                    })
                })
            })

        })
    }
}

// Send the API request to get uploads
function requestUploads(channelId) {
    $.get("uploads/" + channelId, function(data) {
        uploads = JSON.parse(data)
        $.each(uploads, function(index, video) {
            videoIdList.push(video.Id)
        })
    })
}

// Send the API request to get the uploads for this series tracker
function requestSeries(trackerId) {
    $.get("series/" + trackerId, function(data) {
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

    var imgLink = $('<a>')
    imgLink.attr('href', 'http://www.youtube.com/watch?v=' + id)
    imgLink.attr('target', '_blank')
    imgLink.click(function(e) {
        showVideo(videoSnippet.title, id)
        e.preventDefault()
    })

    var img = $('<img>')
    img.attr('src', videoSnippet.thumbnails.medium.url)

    var title = $('<a>')
    title.attr('href', 'http://www.youtube.com/watch?v=' + id)
    title.attr('target', '_blank')
    title.text(videoSnippet.title)

    var channelTitle = $('<a>')
    channelTitle.attr('href', videoSnippet.channelId)
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
    thumbnail.append(imgLink.html(img))
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

// Load the uploads for the specified channel
function loadUploads(channelId, channelName) {

    if (channelId == undefined && channelName == undefined) {
        channelName = 'All Channels '
    }

    window.clearInterval(scrollInterval)

    $('#videoContainer').empty()
    currentChannelId = channelId
    populateSeriesTrackers()

    var button = $('#channelSelector button')
    button.empty()
    button.append(channelName + ' ')
    button.append($('<span class="caret"></span>'))
    $('.typeahead').typeahead('setQuery', '')

    videoIdList = []

    if (currentChannelId == undefined) {
        requestUploads('all')
    } else {
        requestUploads(currentChannelId)
    }

    scrollInterval = setInterval(infiniteScroll, 500)
}

// Populate the quick search box with channels
function populateChannelSearch(subscriptionListItems) {
    var channelDatums = []

    jQuery.each(subscriptionListItems, function(index, item) {
        channelDatums.push({
            value: item.snippet.title,
            channelId: item.snippet.resourceId.channelId
        })
    })

    $('.typeahead').typeahead({
        name: 'channels',
        local: channelDatums,
        template: '<p id={{channelId}}>{{value}}</p>',
        engine: Hogan
    })

    $(document).on('typeahead:selected', function(event, datum) {
        loadUploads(datum.channelId, datum.value)
    })

    $('#newSeriesTracker').click(function() {
        $('#seriesTrackerModal').modal()
    })

    $('#createTracker').click(function() {
        var trackerId = ''
        if (editingTrackerId != undefined) {
            trackerId = editingTrackerId
            editingTrackerId = undefined
        }
        $.post('/addtracker', {
            trackerName: $('#trackerName').val(),
            seriesString: $('#seriesString').val(),
            channelId: currentChannelId,
            trackerId: trackerId
        })
        $('#seriesTrackerModal').modal('hide')
        populateSeriesTrackers()
    })

    $('#seriesTrackerModal').on('hidden.bs.modal', function() {
        $('#trackerName').val('')
        $('#seriesString').val('')
        $('#deleteTracker').remove()
        $('#createTracker').text('Create Tracker')
        editingTrackerId = undefined
    })

    $('#videoViewerModal').on('hidden.bs.modal', function() {
        $('#videoViewerTitle').text('')
        $('#videoViewerModal iframe').attr('src', '')
    })

    $('.dropdown-menu #all-channels').click(function() {
        loadUploads()
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

    $('.videoBox small a').unbind()
    $('.videoBox small a').click(function(e) {
        e.preventDefault()
        loadUploads($(this).attr('href'), $(this).text())
    })

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

function showVideo(title, id) {
    $('#videoViewerTitle').text(title)
    $('#videoViewerModal iframe').attr('src', 'https://www.youtube.com/embed/' + id + '?autoplay=1&vq=hd720')
    $('#videoViewerModal').modal()
}
