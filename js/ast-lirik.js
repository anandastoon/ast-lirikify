/*!
 * ast-input.js
 * http://saya.anandastoon.com/library
 * MIT licensed
 *
 * Copyright (C) 2019 Ananda Maulana Ilhami (Anandastoon), http://anandastoon.com
 */
(function( root, factory ) {
	if( typeof define === 'function' && define.amd ) {
		// AMD. Register as an anonymous module.
		define( function() {
			root.AstLirik = factory();
			return root.AstLirik;
		} );
	} else if( typeof exports === 'object' ) {
		// Node. Does not work with strict CommonJS.
		module.exports = factory();
	} else {
		// Browser globals.
		root.AstLirik = factory();
	}
}( this, function() {

	'use strict';
	var AstLirik;

	// The ast-lirikify.js version
	var VERSION = '0.0.1';

	/**
	 * Generate shuffle number from and to
	 *
	 * @param {l} The length
	 * @param {m} The minimum
	 */
	function shuffle(l, c) {
	    var arr = Array.apply(0,new Array(l)).map(function(h,i){ return i }).filter(function(v){return v != c});
	    var arrP = arr.sort(function(a,b){ return Math.random() > 0.5 });
	    arrP.push(c);
	    return arrP;
	}

	//////////////////////////////////////////////////
	// AST Lirikify API
	//////////////////////////////////////////////////
	AstLirik = function (au, settings = {}) {
		return new Lirikify(au, settings);
	}

	var Lirikify = function (au, settings = {}) {
		// Register an alias for "this"
		var $this = this;

		// Get the audio element
		this.elAudio = document.getElementById(au);

		for (var setting in settings) {
			if (settings.hasOwnProperty(setting)) {
				switch (setting) {
					case 'time':
						this.elAudio.currentTime = settings[setting];
						break;
					case 'speed':
						this.elAudio.playbackRate = settings[setting];
						break;
					default:
						this.elAudio[setting] = settings[setting];
						break;
				}
			}
		}

		if (window.webkitAudioContext)
			this.context = new webkitAudioContext();
		else
			this.context = new AudioContext();

		var _visualizer, _analyser, _bitCount, _audioSource, _dataVisualizer, _canPlay = false, _canPlayT = false, _interval = false;

		// Playlist related, global access
		this.playlist = [];
		this.isShuffle = false;
		this.current = 0;
		this.debugEl;

		// Music property
		this.prop = {
			time: this.elAudio.currentTime,
			volume: this.elAudio.volume,
			speed: this.elAudio.playbackRate,
			src: this.elAudio.src,
			loop: 0,
			muted: this.elAudio.muted,
			duration: this.elAudio.duration
		}

		// Repeat enumeration
		this.repeatState = {
			NONE: 0,
			ONE: 1,
			ALL: 2
		};

		// Time related
		var _t = {
			current: 0,
			readable: "0",
			bufferStart: 0,
			bufferEnd: 0,
			duration: 0,
			buffered: 0,
			pbuffered: 0,
			percentage: 0,
		};

		// Music related
		var _m = {
			waiting: false,
			play: false,
			pause: true,
			end: false,
			loop: false
		};

		var _p = {
			buffer: false,
			i: 0,
			recheck: false,
			arr: 0,
			c: function() {},
			shuffleArr: [],
			shuffleIdx: 0
		};

		// Add pseudo element to get metadata w/o interrupting current audio el.
		// var auPs = document.createElement('audio');
		var auPs = new Audio();

		// Init load
		if (this.elAudio.src != null && this.elAudio.src != "") {
			this.elAudio.crossOrigin = "anonymous";
			this.elAudio.name = this.elAudio.attributes.src.value.replace(/^.*\/|\.$/g, '');
			this.elAudio.load();

			_setPlaylist(this.elAudio.src, this.elAudio.name);
			_updateDuration();
		}

		auPs.onloadedmetadata = _onloadedmetadata;

		function _onloadedmetadata (e) {
			$this.playlist[_p.i].duration = auPs.duration;
			_p.i++;
			if (_p.i < $this.playlist.length) {
				_updateDuration();
				_p.buffer = false;
			} else
				_p.c(_p.i, $this.playlist);
		}

		function _updateDuration() {
			for (var _i = _p.i; _i < $this.playlist.length; _i++) {
				if ($this.playlist[_i].duration == -1) {
					_p.buffer = true;
					auPs.src = $this.playlist[_i].src;
					auPs.load();
					_p.i = _i;
					break;
				}
			}
		}

		// Setup Playlist
		function _setPlaylist(src, name) {
			$this.playlist.push({
				src: src,
				name: name,
				ogg: "",
				duration: -1,
				lyric: {
					is: false,
					lyric: "",
					prop: {},
					next: "",
					index: 0,
					changed: true,
					offset: 0
				}
			});
		}

		// Shuffle playlist
		function _shuffle() {
			_p.shuffleIdx = $this.playlist.length - 1;
			_p.shuffleArr = shuffle($this.playlist.length, $this.current);
		}

		// Internal function to check buffer
		var _bufferInterval = -1;
		function _doBuffer () {
		    _t.buffered = $this.elAudio.buffered.end(0);
		    _t.pbuffered = (_t.buffered / $this.elAudio.duration) * 100; 
		    if (_t.buffered >= $this.elAudio.duration)
		        clearInterval(_bufferInterval);
		}

		// Assign the current playing song index
		function _playTheSong() {
			$this.elAudio.src = $this.playlist[$this.current].src;
			$this.elAudio.load();
			$this.elAudio.play();
			if ($this.playlist[$this.current].lyric.is) $this.playlist[$this.current].lyric.index = 0;
		}

		// Register event
		this.elAudio.onseeking = function () {
		}

		this.elAudio.oncanplay = function () {
			_canPlay = true;
			_t.buffered = $this.elAudio.buffered.end(0);
		    _t.pbuffered = (_t.buffered / $this.elAudio.duration) * 100;
		}

		this.elAudio.oncanplaythrough = function () {
			_canPlayT = true;
			_t.buffered = $this.elAudio.buffered.end(0);
		    _t.pbuffered = (_t.buffered / $this.elAudio.duration) * 100; 
		}

		this.elAudio.onprogress = function() {
			if (_canPlay && _bufferInterval < 0)
	    		_bufferInterval = setInterval(_doBuffer, 100);
		}
		
		this.elAudio.onseeked = function () {
			var _currL = $this.playlist[$this.current].lyric;
			if (_currL.is)
				for (var t = 0; t < _currL.prop.data.length; t ++) {
					if ($this.elAudio.currentTime > _currL.prop.data[t].time) {
						_currL.index = t - 1;
					} else break;
				}
		}

		this.elAudio.onplay = function () {
			if (_visualizer)
	    		_dataVisualizer = new Uint8Array(_analyser.frequencyBinCount);
			_m.waiting = false;
			_m.play = true;
			_m.end = false;
			_m.pause = false;
		};

		this.elAudio.onwaiting = function () {
			_m.waiting = true;
			//_m.pause = true;
		};

		this.elAudio.onended = function () {
			$this.elAudio.currentTime = 0;
			$this.playlist[$this.current].lyric.index = 0;
			switch ($this.prop.loop) {
				case $this.repeatState.NONE:
					_m.end = true;
					_m.play = false;
					break;
				case $this.repeatState.ONE:
					_m.loop = true;
					$this.elAudio.play();
					break;
				case $this.repeatState.ALL:
					$this.playNext();
					_m.loop = true;
					$this.elAudio.play();
					break;
			}
		}

		var updateProp = function (prop) {
			var auProp = prop;
			if (prop == "time") auProp = "currentTime";
			if (prop == "speed") auProp = "playbackRate";
			this.prop[prop] = this.elAudio[auProp];
		}

		var proceedLyric = function (lrc) {
			var _notation = ['ar', 'al', 'ti', 'au', 'id', 'by', 'length', 're', 've', 'offset'];
			var _isNotation = true;
			var _l = [];
			var _s = "";
			var _multipleStamp = false;
			var _lrc = lrc.split("\n");
			var _currL = this.playlist[this.current].lyric;

			// Assign notation to prevent undefined
			for (var _n = 0; _n < _notation.length; _n++) {
				_currL.prop[_notation[_n]] = "";
			}

			// Assign property from lrc file
			for (var l = 0; l < _lrc.length; l++) {
				if (_isNotation) {
					_l = _lrc[l].trim().replace(/[\[\]]/g, '').split(/:(.+)/);

					if (_notation.indexOf(_l[0]) == -1) {
						_currL.prop["data"] = [];
						_isNotation = false;
					} else {
						if (_l[0].trim() != "")
							_currL.prop[_l[0]] = _l[1];
						if (_l[0] == "offset") _currL.offset = _l[1];
					}
				}

				// Time property from lrc
				if (!_isNotation) {
					_s = _lrc[l].trim();
					_s = _s.replace(/\]\s+\[/g, '][');
					var _t = true;
					var _timeArr = [];
					while(_t) {
						if (_s.charAt(0) == "[") {
							_timeArr.push(_s.substring(1, _s.indexOf("]")));
							_s = _s.slice(_s.indexOf("]") + 1);
						} else {
							if (_timeArr.length > 1) _multipleStamp = true;
							for (var _i = 0; _i < _timeArr.length; _i++) {
								var _time = _timeArr[_i].split(/[:\.]/);
								_time = (parseInt(_time[0]) * 60 + parseInt(_time[1]) + parseInt(_time[2]) / 100);
								if (!isNaN(_time)) {
									if (_currL.prop["data"].length == 0) {
										if (_time > 0.00) 
											_currL.prop["data"].push({at: "00:00.00", lyric: "", time: 0 });
									}
									_currL.prop["data"].push({at: _timeArr[_i], lyric: _s, time: _time });
								}
							}
							_t = false;
						}
					}
				}
			}

			if (_multipleStamp) {
				_currL.prop["data"].sort(function(a, b) {
					return a.time - b.time;
				});
			}

			if (_currL.prop.data.length > 0) _currL.is = true;
		}

		Lirikify.prototype.pAdd = function (files, callback) {
			// Apply callback when loadedmetadata finished
			if (callback && {}.toString.call(callback) === '[object Function]') {
				_p.c = callback;
			}
			for (var _f = 0; _f < files.length; _f++) {
				var _src;
				var _name;
				if (typeof files[_f] === "object") {
					_src = (window.URL || window.webkitURL).createObjectURL(files[_f]);
					_name = files[_f].name;
				} else if (typeof files[_f] === "string") {
					_src = files[_f];
					_name = files[_f].split('/').pop();
				}
				_setPlaylist(_src, _name);
			}

			_p.i = 0;
			_p.recheck = true;
			auPs.onloadedmetadata = _onloadedmetadata;
			_updateDuration();
		};

		Lirikify.prototype.pRemove = function (i) {
			if (this.current == i) return 0;
			if (this.current > i) {
				_p.shuffleIdx--;
				this.current = _p.shuffleIdx;
			}
			if (this.isShuffle) _shuffle();
			this.playlist.splice(i, 1);
		};

		Lirikify.prototype.shuffle = function (b) {
			b = !!b;
			if (b)
				_shuffle();
			this.isShuffle = b;
		};

		Lirikify.prototype.playNext = function () {
			if ($this.playlist.length > 1) {
				_p.shuffleIdx++;
				_p.shuffleIdx %= $this.playlist.length;
				$this.current = $this.isShuffle ? _p.shuffleArr[_p.shuffleIdx] : _p.shuffleIdx;
			} else {
				_p.shuffleIdx = 0;
				$this.current = _p.shuffleIdx; 
			}
			_playTheSong();
		};

		Lirikify.prototype.playPrev = function () {
			if ($this.elAudio.currentTime > 3) {
				$this.elAudio.currentTime = 0;
				return 0;
			}
			if ($this.playlist.length > 1) {
				_p.shuffleIdx--;
				if (_p.shuffleIdx < 0) _p.shuffleIdx = $this.playlist.length - 1;
				$this.current = $this.isShuffle ? _p.shuffleArr[_p.shuffleIdx] : _p.shuffleIdx;
			} else {
				_p.shuffleIdx = 0;
				$this.current = _p.shuffleIdx; 
			}
			_playTheSong();
		};

		Lirikify.prototype.setLyric = function (lrc, lyricDelay = 0, callback) {
			var _fr = new FileReader();
			_fr.onload = function(e) {
				proceedLyric.call($this, e.target.result);
				if (callback && {}.toString.call(callback) === '[object Function]')
					callback($this.playlist[$this.current].lyric.prop);
					$this.elAudio.play();
					$this.update();
			};
			$this.playlist[$this.current].lyric.offset += lyricDelay;
			_fr.readAsText(lrc);
			return this;
		}

		Lirikify.prototype.setLyricFromInternet = function(pathFile, callback) {
			var _xhr = new XMLHttpRequest();
			_xhr.onreadystatechange = function() {
			    if (_xhr.readyState == 4) {
			        if (_xhr.status == 200) {
			            callback(_xhr.responseText);
						proceedLyric.call($this, _xhr.responseText);
			        } else {
			            callback(null);
			        }
			    }
			};
			_xhr.open("GET", pathFile, true);
			_xhr.responseType = "text";
			_xhr.send();
		}

		Lirikify.prototype.update = function (callback) {
			var _callback = callback;
			if (!_interval) {
				_interval = true;
				_updateLyric();
			}

			function _updateLyric() {
				var _currL = $this.playlist[$this.current].lyric;
				if (!$this.elAudio.paused) {
					// Check lyric
					if (typeof _currL.prop.data != "undefined") {
						if (_currL.index + 1 < _currL.prop.data.length && _currL.prop.data[_currL.index + 1].time < $this.elAudio.currentTime - parseFloat(_currL.offset) / 1000) {
							_currL.index ++;
							_currL.current = _currL.prop.data[_currL.index].lyric;
							_currL.next = typeof _currL.prop.data[_currL.index + 1] != "undefined" ? _currL.prop.data[_currL.index + 1].lyric : "";
							_currL.changed = true;
						}
					}
				}

				_t.current = $this.elAudio.currentTime;
				_t.readable = ("00" + Math.floor(_t.current / 60)).slice(-2) + ":" + ("00" + parseInt(_t.current % 60)).slice(-2);
				_t.percentage = _t.current / $this.elAudio.duration * 100;

				if (_callback && {}.toString.call(_callback) === '[object Function]') _callback(_t, _currL.current, _currL.changed, _m, _dataVisualizer);
				if (_currL.changed) _currL.changed = false;
				_m.loop = false;
				_m.end = false;

				if (_visualizer)
		    		_analyser.getByteFrequencyData(_dataVisualizer);

				window.requestAnimationFrame(_updateLyric);
			}
		}

		Lirikify.prototype.play = function (src = "", refresh = false) {
			try {
				if (src != "") {
					this.elAudio.src = src;
					this.elAudio.load();
				}
				this.elAudio.play();
				if (_m.end) {
					_m.end = false;
					$this.elAudio.currentTime = 0;
				}
				if (refresh) {
					if ($this.isShuffle) _shuffle();
					_p.shuffleIdx = this.current;
				}
			} catch (e) {
				throw e;
			}
			
			return this;
		}

		Lirikify.prototype.stop = function () {
			this.elAudio.currentTime = 0;
			this.elAudio.pause();
			_m.pause = true;
			_m.end = true;
			$this.playlist[$this.current].lyric.index = 0;
			updateProp.call(this, "time");
			return this;
		}

		Lirikify.prototype.pause = function () {
			this.elAudio.pause();
			_m.pause = true;
			updateProp.call(this, "time");
			return this;
		}

		Lirikify.prototype.seek = function (time) {
			this.elAudio.currentTime = time;
			updateProp.call(this, "time");
			return this;
		}

		Lirikify.prototype.forward = function (time = 10) {
			this.elAudio.currentTime += time;
			this.elAudio.onseeked();
			updateProp.call(this, "time");
			return this;
		}

		Lirikify.prototype.backward = function (time = 10) {
			this.elAudio.currentTime -= time;
			this.elAudio.onseeked();
			updateProp.call(this, "time");
			return this;
		}

		Lirikify.prototype.speed = function (rate) {
			this.elAudio.playbackRate = rate;
			this.prop.speed = rate;
			updateProp.call(this, "speed");
			return this;
		}

		Lirikify.prototype.volume = function (vol) {
			this.elAudio.volume = vol;
			this.prop.volume = vol;
			updateProp.call(this, "volume");
			return this;
		}

		Lirikify.prototype.mute = function (bool) {
			this.elAudio.muted = bool;
			this.prop.muted = bool;
			return this;
		}

		Lirikify.prototype.loop = function (bool = true) {
			this.prop.loop = bool ? this.repeatState.ALL : this.repeatState.NONE;
			return this;
		}

		Lirikify.prototype.repeat = function (rep) {
			if (typeof rep == "undefined") {
				rep = this.prop.loop + 1;
				rep %= 3;
			}
			this.prop.loop = rep;
			return this;
		}

		Lirikify.prototype.setVisualiser = function () {
			_visualizer = true;
			_analyser = this.context.createAnalyser();
			_audioSource = this.context.createMediaElementSource(this.elAudio);
			_audioSource.connect(_analyser);
	    	_analyser.connect(this.context.destination);
			_analyser.fftSize = 256;
	    	_dataVisualizer = new Uint8Array(_analyser.frequencyBinCount);
			return this;
		}

		Lirikify.prototype.debug = function (debugEl) {
			this.debugEl = document.getElementById(debugEl);
			return this;
		};

		Lirikify.prototype.grab = function (link, callback) {
			if (link == "") {
				callback(false);
				return 0;
			}
			var _check = true;
			auPs.src = link;
			auPs.load();
			auPs.onloadedmetadata = function (e) {
				if (!_check) return false;
				callback(true);
				$this.pAdd([this.src], callback);
				_check = false;
			}
			auPs.onerror = function (e) {
				if (_check)
					callback(false);
			}
		};

		return this;
	}

	return AstLirik;
}));