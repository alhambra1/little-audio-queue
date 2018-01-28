/**
* An audio queue to load arrayBuffers
* and provide access to them in order to attempt
* to store audio in an Indexed DB. Uses some
* of the same object attrbutes and functions
* as preloadjs-0.6.2.
*
* Written by Gilad Barkan August, 2017
* Covered by the "Do whatever the heck you want with it" licence, 
* the full text of which is: Do whatever the heck you want with it. 
* [Attributed to http://stackoverflow.com/users/14860/paxdiablo]
*/

function LittleAudioQueue(start=true, opts={}){
	var queue = this;

	// Currently only supports arraybuffer
	this.responseType = opts.responseType || 'arraybuffer';

	this.debug = opts.debug || false;
	this.error = function(){
		if (queue.debug)
			console.error.apply(console, arguments);
	}

	this.cancelled = false;
	this.loading = false;
	this.loaded = false;

	this.queue = [];
	this.pending = {};
	this._loadedResults = {};
	this._rawResults = {};
	this._errorHistory = {};

	this.audioElementFromArrayBuffer = function(arrayBuffer){
		var element = document.createElement('audio'),
			blob = new Blob([new Uint8Array(arrayBuffer)], { type: 'audio/mpeg'}),
			URL = window.URL || window.webkitURL,
			blobUrl = URL.createObjectURL(blob);

		element.src = blobUrl;
		return element;
	}

	this.eventCallbacks = {
		fileload: function(fileObj, response){
			queue.pending[fileObj.src] = 0;
			queue.determineCompletion();

			var element = queue.audioElementFromArrayBuffer(response);

			// We need the raw arrayBuffer or blob to store in the IndexedDB
			queue._rawResults[fileObj.src] = response;

			queue._loadedResults[fileObj.src] = fileObj;

			var obj = {
					result: element,
					item: fileObj
				};

			if (typeof queue.customEventCallbacks.fileload == 'function')
				queue.customEventCallbacks.fileload(obj);
		},
		error: function(fileObj, event){
			delete queue.pending[fileObj.src];
			queue.determineCompletion();

			if (queue._errorHistory[fileObj.src])
				queue._errorHistory[fileObj.src].push('Error');
			else
				queue._errorHistory[fileObj.src] = ['Error'];

			queue.error('LittleAudioQueue XMLHttpRequest error:', {file_obj: fileObj});

			if (typeof queue.customEventCallbacks.fileload == 'function'){
				var obj = {
						title: 'LittleAudioQueue XMLHttpRequest Error',
						message: 'error loading file',
						data: fileObj
					};

				queue.customEventCallbacks.error(obj);
			}
		}
	}

	this.customEventCallbacks = {};

	this.on = function(eventName, func){
		this.customEventCallbacks[eventName] = func;
	}

	this.loadManifest = function(manifest){
		if (!queue.cancelled){
			queue.queue = queue.queue.concat(manifest);
			if (!queue.loading)
				queue.start();
		}
	}

	this.isComplete = function(){
		var pending = 0;
		for (let i in this.pending)
			pending += this.pending[i];

		return !pending && !this.queue.length;
	}

	this.determineCompletion = function(){
		if (queue.isComplete()){
			queue.loading = false;
			queue.loaded = true;
			
			if (typeof queue.customEventCallbacks.complete == 'function')
				queue.customEventCallbacks.complete({target: queue});
		}
	}

	this.load = function(fileObj){
		if (!queue.pending[fileObj.src] && !queue._loadedResults[fileObj.src]){

			var request = new XMLHttpRequest();

			queue.pending[fileObj.src] = 1;

			request.open('GET', fileObj.src, true);

			request.responseType = this.responseType;

			request.onload = function(){
				queue.eventCallbacks.fileload(fileObj, request.response);
			}
			request.onerror = function(event){
				queue.eventCallbacks.error(fileObj, event);
			}

			request.send();
		}

		if (!queue.cancelled && this.queue.length)
			queue.load(this.queue.shift());
	}

	this.start = function(){
		if (queue.queue.length){
			queue.load(this.queue.shift());
			queue.loading = true;
			queue.loaded = false;

		} else {
			queue.error('LittleAudioQueue error: start() called on empty queue!');
		}
	}

	this.cancel = function(){
		queue.cancelled = true;
	}

	if (start)
		queue.start();
}
