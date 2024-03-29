
// screen size variables
var SCREEN_WIDTH = window.innerWidth,
	SCREEN_HEIGHT = window.innerHeight,
	HALF_WIDTH = window.innerWidth / 2,
	HALF_HEIGHT = window.innerHeight / 2,

	rotateDialBrightness= 0,
	fps = 60,
	mpf = 1000/fps,
	counter = 0,
	gameStartTime = Date.now(),
	skippedFrames,
	upKey = 'W',
	leftKey = 'A',
	rightKey = 'D',
	startKey = ' ',
	selectKey = '',
	abortKey = '',
	startMessage = "INSERT COINS<br><br>CLICK TO PLAY<br>ARROW KEYS TO MOVE",
	singlePlayMode = false, // for arcade machine
	lastMouseMove = Date.now(),
	lastMouseHide =0,
	mouseHidden = false,
	lander_pad_diff = new Vector2(0,0);


// game states
var	WAITING = 0,
	PLAYING = 1,
	LANDED = 2,
	CRASHED = 3,
	GAMEOVER = 4,

	gameState = GAMEOVER,
	mouseThrust = false,
	mouseTop = 0,
	mouseBottom = 0,

	score = 0,
	time = 0,

	lander = new Lander(),
	landscape = new Landscape(),
	testPoints = [],

// canvas element and 2D context
	canvas = document.createElement( 'canvas' ),
	context = canvas.getContext( '2d' ),

// to store the current x and y mouse position
	mouseX = 0, mouseY = 0,

	stats = new Stats(),

// to convert from degrees to radians,
// multiply by this number!
	TO_RADIANS = Math.PI / 180,

	view = {x:0,
			y:0,
			scale :1,
			left :0,
			right : 0,
			top :0,
			bottom:0},
	zoomedIn = false,
	zoomFactor = 4;


window.addEventListener("load", init);


function init()
{
	// CANVAS SET UP

	document.body.appendChild(canvas);

	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = (SCREEN_HEIGHT-45)+'px';

	infoDisplay = new InfoDisplay(SCREEN_WIDTH, SCREEN_HEIGHT);
	document.body.appendChild(infoDisplay.domElement);

	canvas.width = SCREEN_WIDTH;
	canvas.height = SCREEN_HEIGHT;


	document.body.addEventListener('mousedown', onMouseDown);
	document.body.addEventListener('mousemove', onMouseMove);

	KeyTracker.addKeyDownListener(KeyTracker.UP, function() { if(gameState==PLAYING) lander.thrust(1);});
	KeyTracker.addKeyUpListener(KeyTracker.UP, function() { lander.thrust(0);});
	if (upKey) {
		KeyTracker.addKeyDownListener(upKey.charCodeAt(0), function() { if(gameState==PLAYING) lander.thrust(1);});
		KeyTracker.addKeyUpListener(upKey.charCodeAt(0), function() { lander.thrust(0);});
	}


	window.addEventListener('resize', resizeGame);
	window.addEventListener('orientationchange', resizeGame);

	resizeGame();
	restartLevel();

	loop();

}

function loop() {
	requestAnimationFrame(loop);

	skippedFrames = 0;

	counter++;
	var c = context;

	var elapsedTime = Date.now() - gameStartTime;
	var elapsedFrames = Math.floor(elapsedTime/mpf);
	var renderedTime = counter*mpf;

	if(elapsedFrames<counter) {
		counter--;
		return;
	}

	while(elapsedFrames > counter) {
		lander.update();

		counter++;

		skippedFrames ++;
		if (skippedFrames>30) {
			//set to paused
			counter = elapsedFrames;
		}

	}

	if(gameState == PLAYING) {
		checkKeys();
	}

	lander.update();
	var offsetX = landscape.landingPad.x - lander.pos.x;
	var offsetY = landscape.landingPad.y - lander.bottom;
	if (offsetY < 0) offsetY = 0;
	lander.offset = new Vector2(offsetX, offsetY);

	if((gameState == WAITING) && (lander.altitude<100) ) {
		gameState=GAMEOVER;
		restartLevel();
	}

	if((gameState== PLAYING) || (gameState == WAITING))
		checkCollisions();

	updateView();
	render();
	if((!mouseHidden) && (Date.now() - lastMouseMove >1000)){
		 document.body.style.cursor = "none";
		lastMouseHide = Date.now();
		mouseHidden = true;
	}
}

function render() {

	var c = context;

	c.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

	c.save();
	c.translate(view.x, view.y);
	c.scale(view.scale, view.scale);


	landscape.render(context, view);
	lander.render(context, view.scale);


	if(counter%4==0) updateTextInfo();

	c.restore();
}

function checkKeys() {

	if((KeyTracker.isKeyDown(leftKey))||(KeyTracker.isKeyDown(KeyTracker.LEFT))) {
		lander.rotate(-1);
	} else if((KeyTracker.isKeyDown(rightKey))||(KeyTracker.isKeyDown(KeyTracker.RIGHT))) {
		lander.rotate(1);
	}
	if(KeyTracker.isKeyDown(abortKey)) {
		lander.abort();
	}

	// SPEED MODE!
	if(KeyTracker.isKeyDown('S')) {
		for(var i=0; i<3;i++) lander.update();
	}

}


function updateView()
{
	var zoomamount  = 0,
	 	marginx  = SCREEN_WIDTH *0.2,
		margintop = SCREEN_HEIGHT * 0.2,
		marginbottom = SCREEN_HEIGHT * 0.3;

	if((!zoomedIn) && (lander.altitude < 70)) {
		setZoom(true);
	} else if((zoomedIn) && (lander.altitude > 160)) {
		setZoom(false);
	}

	zoomamount = view.scale;
	if (zoomedIn) {
		if(((lander.pos.x * zoomamount) + view.x < marginx)){
			view.x = -(lander.pos.x * zoomamount) + marginx;
		} else if (((lander.pos.x * zoomamount) + view.x > SCREEN_WIDTH - marginx)) {
			view.x = -(lander.pos.x * zoomamount) + SCREEN_WIDTH - marginx;
		}

		if((lander.pos.y * zoomamount) + view.y < margintop) {
			view.y = -(lander.pos.y * zoomamount) + margintop;
		} else if ((lander.pos.y * zoomamount) + view.y > SCREEN_HEIGHT - marginbottom) {
			view.y = -(lander.pos.y * zoomamount) + SCREEN_HEIGHT - marginbottom;
		}
	}
	if (lander.pos.x < 0 && gameState != CRASHED){
		setCrashed();
		// view.x = -(lander.pos.x * zoomamount) + marginx;
	} else if (lander.pos.x > SCREEN_WIDTH && gameState != CRASHED) {
		// view.x = -(lander.pos.x * zoomamount) + SCREEN_WIDTH - marginx;
		setCrashed();
	}

	if((lander.pos.y * zoomamount) + view.y < margintop) {
		view.y = -(lander.pos.y * zoomamount) + margintop;
	} else if ((lander.pos.y * zoomamount) + view.y > SCREEN_HEIGHT - marginbottom) {
		view.y = -(lander.pos.y * zoomamount) + SCREEN_HEIGHT - marginbottom;
	}


	view.left = -view.x/view.scale;
	view.top = -view.y/view.scale;
	view.right = view.left + (SCREEN_WIDTH/view.scale);
	view.bottom = view.top + (SCREEN_HEIGHT/view.scale);

}

function setLanded(line) {

	multiplier = line.multiplier;
	lander.land();

	var points = 0;
	if(lander.vel.y<0.075) {
		points = 50 * multiplier;
		infoDisplay.showGameInfo("CONGRATULATIONS<br>A PERFECT LANDING\n" + points + " POINTS");
		lander.fuel+=50;
	} else {
		points = 15 * multiplier;
		infoDisplay.showGameInfo("YOU LANDED HARD<br>YOU ARE HOPELESSLY MAROONED<br>" + points + " POINTS");
		lander.makeBounce();
	}

	score+=points;

	gameState = LANDED;
	if(singlePlayMode) {
		setGameOver();
	}
	scheduleRestart();
}

function setCrashed() {
	lander.crash();

	// store x distance to pad
	// store y velocity
	// reward = -100
	// lost fuel during run


	// show crashed message
	// subtract fuel

	var fuellost = Math.round(((Math.random() * 200) + 200));
	lander.fuel -= fuellost;


	if(lander.fuel<1) {
		setGameOver();
		msg = "OUT OF FUEL<br><br>GAME OVER";

	} else {
		var rnd  = Math.random();
		var msg ='';
		if(rnd < 0.3){
			msg = "YOU JUST DESTROYED A 100 MEGABUCK LANDER";
		} else  if(rnd < 0.6){
			msg = "DESTROYED";
		} else {
			msg = "YOU CREATED A TWO MILE CRATER";
		}

		msg = "AUXILIARY FUEL TANKS DESTROYED<br>" + fuellost + " FUEL UNITS LOST<br><br>" + msg;

		gameState = CRASHED;
		//ARCADE AMENDMENT
		if(singlePlayMode) {
			setGameOver()
		}
	}

	infoDisplay.showGameInfo(msg);

	scheduleRestart();

	samples.explosion.play();
}

function setGameOver() {

		gameState = GAMEOVER;
}

function onMouseDown(e) {
	e.preventDefault();
	if(gameState==WAITING) newGame();
}

function newGame() {

	lander.fuel = 1000;

	time = 0;
	score = 0;

	gameStartTime = Date.now();
	counter = 0;

	restartLevel();

}

function scheduleRestart() {
	setTimeout(restartLevel,4000);

}

function restartLevel() {
	lander.reset();
	landscape.setZones();
	setZoom(false);

	if(gameState==GAMEOVER) {
		gameState = WAITING;
		showStartMessage();
		lander.vel.x = 2;

	} else {
		gameState = PLAYING;
		infoDisplay.hideGameInfo();
	}


}

function checkCollisions() {

	var lines = landscape.lines,
		right = lander.right%landscape.tileWidth,
		left = lander.left%landscape.tileWidth;

		while(right<0){
			right+=landscape.tileWidth;
			left += landscape.tileWidth;
		}


	for(var i=0; i<lines.length; i++ ) {
		line = lines[i];
		line.checked = false;
		// if the ship overlaps this line
		if(!((right<line.p1.x) || (left>line.p2.x))){

			lander.altitude = line.p1.y-lander.bottom;
				line.checked = true;

			// if the line's horizontal
			if(line.landable) {
				// and the lander's bottom is overlapping the line
				if(lander.bottom>=line.p1.y) {

					if((left>line.p1.x) && (right<line.p2.x)) {

						if((lander.rotation==0) && (lander.vel.y<0.15)) {
							//console.log('horizontal and slow');
							setLanded(line);
						} else {
							setCrashed();
						}
					} else {
						// if we're not within the line
						setCrashed();
					}
				}
				// if lander's bottom is below either of the two y positions
			} else if(( lander.bottom > line.p2.y) || (lander.bottom > line.p1.y)) {
				lander.bottomRight.x = right;
				lander.bottomLeft.x = left;

				if( pointIsLessThanLine(lander.bottomLeft, line.p1, line.p2) ||
						pointIsLessThanLine(lander.bottomRight, line.p1, line.p2)) {

					setCrashed();
				}
			}
		}
	}

};

function pointIsLessThanLine(point, linepoint1, linepoint2) {

	// so where is the y of the line at the point of the corner?
	// first of all find out how far along the xaxis the point is
	var dist = (point.x - linepoint1.x) / (linepoint2.x - linepoint1.x);
	var yhitpoint  = linepoint1.y + ((linepoint2.y - linepoint1.y) * dist);
//	addTestPoint(point.x, yhitpoint);
	return ((dist > 0) && (dist < 1) && (yhitpoint <= point.y)) ;
}

function updateTextInfo() {

	infoDisplay.updateBoxInt('score', score, 4);
	infoDisplay.updateBoxInt('fuel', lander.fuel, 4);
	if(gameState == PLAYING) infoDisplay.updateBoxTime('time', counter*mpf);

	infoDisplay.updateBoxInt('alt', (lander.altitude<0) ? 0 : lander.altitude, 4);
	infoDisplay.updateBoxInt('horizSpeed', (lander.vel.x*200));
	infoDisplay.updateBoxInt('vertSpeed', (lander.vel.y*200));

	// +(lander.vel.x<0)?' ‹':' ›'
	// +(lander.vel.y<0)?' ˆ':' >'

	if((lander.fuel < 300) && (gameState == PLAYING)) {
		if((counter%50)<30) {
			var playBeep;
			if(lander.fuel <= 0) {
				playBeep = infoDisplay.showGameInfo("Out of fuel");
			} else {
				playBeep = infoDisplay.showGameInfo("Low on fuel");
			}
			if(playBeep) samples.beep.play();
		} else {
			infoDisplay.hideGameInfo();
		}


	}

}

function showStartMessage() {
	infoDisplay.showGameInfo(startMessage);
}

function setZoom(zoom )
{
	if(zoom){
		view.scale = SCREEN_HEIGHT/700*5;
		zoomedIn = true;
		view.x = -lander.pos.x * view.scale + (SCREEN_WIDTH / 2);
		view.y = -lander.pos.y * view.scale + (SCREEN_HEIGHT * 0.25);
		lander.scale = 0.25;

	}
	else {

		view.scale = SCREEN_HEIGHT/700;
		zoomedIn = false;
		lander.scale = 0.6;
		view.x = 0;
		view.y = 0;
	}
	/*
	for (var id in players) {
		var player = players[id];
		player.scale = lander.scale;
	}*/


}

// returns a random number between the two limits provided
function randomRange(min, max){
	return ((Math.random()*(max-min)) + min);
}

function clamp(value, min, max) {
	return (value<min) ? min : (value>max) ? max : value;
}

function map(value, min1, max1, min2, max2, clamp) {
	clamp = typeof clamp !== 'undefined' ? clamp : false;


	if(clamp) {
		if(min1>max1) {
			var tmp = min1;
			min1 = max1;
			max1 = tmp;
			tmp = min2;
			min2 = max2;
			max2 = tmp;

		}
		if (value<=min1) return min2;
		else if(value>=max1) return max2;
	}


	return (((value-min1)/(max1-min1)) * (max2-min2))+min2;
}


function onMouseMove( event )
{
	mouseX = ( event.clientX - HALF_WIDTH );
	mouseY = ( event.clientY - HALF_HEIGHT );
	if((mouseHidden) && (Date.now() - lastMouseHide> 400)){
		document.body.style.cursor = "default";

		mouseHidden = false;
	//	console.log("mouse move "+ canvas.style.cursor);
	}
	lastMouseMove = Date.now();
}

function resizeGame (event) {

	var newWidth = window.innerWidth;
	var newHeight = window.innerHeight;

	if((SCREEN_WIDTH== newWidth) && (SCREEN_HEIGHT==newHeight)) return;

	SCREEN_WIDTH = canvas.width = newWidth;
	SCREEN_HEIGHT = canvas.height = newHeight;

	setZoom(zoomedIn) ;
	stats.domElement.style.top = (SCREEN_HEIGHT-45)+'px';
	infoDisplay.arrangeBoxes(SCREEN_WIDTH, SCREEN_HEIGHT);

}
