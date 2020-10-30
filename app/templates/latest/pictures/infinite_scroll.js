var totalPosts = {{total_posts}};
var postsContainer = document.querySelector('.fixed-posts');
var currentPosts = postsContainer.children.length;

(function fillOutPlaceholders(){

	var documentFragment = document.createDocumentFragment();

	// Create placeholders
	for (var i = currentPosts; i < totalPosts; i++) {
		let newLink = generatePlaceholder(i, totalPosts);
		documentFragment.appendChild(newLink);
	}

	postsContainer.appendChild(documentFragment);

}());

function padLastRow () {

	// determine items per row
	let baseline = document.getElementById('post-' + totalPosts).offsetTop;

	for (var itemsPerLine = 1; itemsPerLine < totalPosts; itemsPerLine++) {
		let link = document.getElementById('post-' + (totalPosts - itemsPerLine));
		if (link.offsetTop !== baseline) break;
	}

	let existingPadders = document.querySelectorAll('.padder');

	let desiredPlaceholders = itemsPerLine - (totalPosts % itemsPerLine);

	if (desiredPlaceholders === itemsPerLine) return;

	if (existingPadders.length === desiredPlaceholders) return;

	// remove existing padders
	existingPadders.forEach(function(node){
		node.parentNode.removeChild(node);
	});

	var documentFragment = document.createDocumentFragment();

	for (var i = 0; i < desiredPlaceholders;i++) {
		let newLink = generatePlaceholder(totalPosts + i, totalPosts);
		newLink.className += ' padder';
		documentFragment.appendChild(newLink);
	}

	postsContainer.appendChild(documentFragment);

	console.log('desiredPlaceholders', desiredPlaceholders);
};

padLastRow();

window.onresize = padLastRow;

function generatePlaceholder(i, totalPosts){
	let newLink = document.createElement('a');
	newLink.className = 'fixed-post photo';
	newLink.id = 'post-' + (totalPosts - i);
	newLink.appendChild(document.createElement('span'));
	newLink.appendChild(document.createElement('i'));
	newLink.href = '#!';
	return newLink
}

loadPage(2, function(err, entries){
	entries.forEach(function(entry){
		var link = document.getElementById('post-' + entry.index);
		link.href = entry.url;
		link.innerHTML = '<img src="' + entry.thumbnail.medium.url + '" class="pre-loaded" onload="this.className+=\' loaded\';" /><noscript><img src="' + entry.thumbnail.medium.url + '"></noscript>'
	});
});

function loadPage(pageNo, callback) {
	getJSON('/page/' + pageNo + '?json=true', function(err, json){
		if (err) return callback(err);
		callback(null, json.entries);
	})
}


function getJSON (url, callback) {
	var request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.onload = function() {
	  if (request.status >= 200 && request.status < 400) {
	    callback(null, JSON.parse(request.responseText));
	  } else {
			callback(new Error('Failed to get JSON'));
	  }
	};

	request.onerror = function() {
		callback(new Error('Failed to make request to get JSON'));
	};

	request.send();