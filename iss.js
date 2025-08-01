// ISS 3D model
var config = {dirPath: '/Nasa_Space_App/3D-model/'};
var cur_iss_position = [0, 0, 0];
var colladaLoader = new WorldWind.ColladaLoader(
    new WorldWind.Position(cur_iss_position[0], cur_iss_position[1], cur_iss_position[2] * 1000),
    config
    );

var model;
colladaLoader.load("textured.dae", function (colladaModel) {
	model = colladaModel;
    colladaModel.scale = 140000;
	colladaModel.xRotation = 20000;
    modelLayer.addRenderable(colladaModel);
});

let roundDecimal = function (val, precision) {
          return Math.round(Math.round(val * Math.pow(10, (precision || 0) + 1)) / 10) / Math.pow(10, (precision || 0));
}
const issRouteSec = 10800;

function focusISS() {
    wwd.goToAnimator.animationFrequency = 10;
    wwd.goTo(new WorldWind.Location(cur_iss_position[0], cur_iss_position[1]));
}

function get_iss_pos(satrec, time) {
    time = toDateTime(time);
    //  Propagate satellite using JavaScript Date
    var positionAndVelocity = satellite.propagate(satrec, time);

    // The position_velocity result is a key-value pair of ECI coordinates.
    // These are the base results from which all other coordinates are derived.
    var positionEci = positionAndVelocity.position,
        velocityEci = positionAndVelocity.velocity;

    // You will need GMST for some of the coordinate transforms.
    // http://en.wikipedia.org/wiki/Sidereal_time#Definition
    var gmst = satellite.gstime(time);
    var positionGd    = satellite.eciToGeodetic(positionEci, gmst);
    // Geodetic coords are accessed via `longitude`, `latitude`, `height`.
    var longitude = positionGd.longitude,
        latitude  = positionGd.latitude,
        height    = positionGd.height;

    var a = 57.2957795;
    return [latitude * a, longitude * a, height * 1000, velocityEci];
}

function get_calotta(isspos) {
    const re = 6371.0;
    const R = isspos[2] / 1000 + re;
    // const perimeter = re * 2000 * Math.PI;
    const fake_la = Math.acos(re / R);

    return re * 1000 * fake_la; // perimeter * fake_la / (Math.Pi * 2)
}

function get_route(time) {
    var positions = [];
    var t = time - issRouteSec/2;
    for (var i = 0; i <= issRouteSec; i+=360) {
        var pos = get_iss_pos(satrec, t + i);
        positions.push(new WorldWind.Position(pos[0], pos[1], pos[2]));
    }

    return positions;
}

var issRouteAttributes_pre = new WorldWind.ShapeAttributes();
    issRouteAttributes_pre.outlineColor = WorldWind.Color.YELLOW;
    issRouteAttributes_pre.interiorColor = new WorldWind.Color(0, 0, 0, 0);
    issRouteAttributes_pre.outlineWidth = 3;

var issRouteAttributes_pos = new WorldWind.ShapeAttributes();
    issRouteAttributes_pos.outlineColor = new WorldWind.Color(1, 1, 1, 1);
    issRouteAttributes_pos.interiorColor = new WorldWind.Color(0, 0, 0, 0);
    issRouteAttributes_pos.outlineWidth = 3;

var headRouteTextAttributs = new WorldWind.TextAttributes();
    headRouteTextAttributs.color = new WorldWind.Color(1, 1, 1, 1);
    headRouteTextAttributs.font.size = 36;
    headRouteTextAttributs.enableOutline = true;
var tailRouteTextAttributs = new WorldWind.TextAttributes();
    tailRouteTextAttributs.color = WorldWind.Color.YELLOW;
    tailRouteTextAttributs.font.size = 36;
    tailRouteTextAttributs.enableOutline = true;

function draw_route(time) {
    routeLayer.removeAllRenderables();
    
    var positions = get_route(time);
    var mid = Math.floor(positions.length / 2);
    var issRoute_pre = new WorldWind.Path(positions.slice(0, mid + 1), issRouteAttributes_pre);
    var issRoute_pos = new WorldWind.Path(positions.slice(mid, positions.length), issRouteAttributes_pos);
    routeLayer.addRenderable(issRoute_pre);
    routeLayer.addRenderable(issRoute_pos);

    var headRouteText = new WorldWind.GeographicText(positions[positions.length-1], "+1.5hr");
    headRouteText.attributes = headRouteTextAttributs;
    headRouteText.alwaysOnTop = true;
    routeLayer.addRenderable(headRouteText);
    var tailRouteText = new WorldWind.GeographicText(positions[0], "-1.5hr");
    tailRouteText.attributes = tailRouteTextAttributs;
    tailRouteText.alwaysOnTop = true;
    routeLayer.addRenderable(tailRouteText);

    routeLayer.refresh();
}

var prevCalotta;
function draw_calotta(isspos) {
    var attributes = new WorldWind.ShapeAttributes(null);
        attributes.outlineColor = WorldWind.Color.GREEN;
        attributes.interiorColor = new WorldWind.Color(0, 1, 1, 0.2);
        attributes.outlineWidth = 2;
    if (prevCalotta) {
        modelLayer.removeRenderable(prevCalotta);
    }
    
    var curCalotta = new WorldWind.SurfaceCircle(new WorldWind.Location(isspos[0], isspos[1]), get_calotta(isspos), attributes);
    modelLayer.addRenderable(curCalotta);
    // modelLayer.refresh();
    // wwd.redraw();

    prevCalotta = curCalotta;
}

// calculate ISS position every second

var la_diff = 0, long_diff = 0;
function draw_ISS(pos) {
    cur_iss_position = pos;
    colladaLoader.position['latitude'] = pos[0];
    colladaLoader.position['longitude'] = pos[1];
    colladaLoader.position['altitude'] = pos[2];

	var sun_pos = calculateSunPosition(toDateTime(get_render_time()));
    if (model) {
    	model.xRotation = -10000/90*la_diff/180;
	    model.yRotation = -10000/90*long_diff/180;

    	la_diff = pos[0] - sun_pos[0];
	    long_diff = pos[1] - sun_pos[1];

    	model.xRotation = 10000/90*la_diff/180;
	    model.yRotation = 10000/90*long_diff/360;
    }
};

function updateISS() {
    var time = get_render_time();
    var pos = get_iss_pos(satrec, time);
    draw_ISS(pos);
    draw_route(time);
    draw_calotta(pos);
    // redraw
    modelLayer.refresh();
    wwd.redraw();
}

function updateInfo() {
    var time = get_render_time();
    var pos = get_iss_pos(satrec, time);
    var velocity = Math.sqrt(pos[3]['x'] * pos[3]['x'] + pos[3]['y'] * pos[3]['y'] + pos[3]['z'] * pos[3]['z']);
    var lo = roundDecimal(pos[1], 4);
    var la = roundDecimal(pos[0], 4);
    var info = `
        Longtitude: ${Math.abs(lo)}${lo > 0 ? "°E" : "°W"}
        Latitude: ${Math.abs(la)}${la > 0 ? "°N" : "°S"}
        Altitude: ${roundDecimal(pos[2] / 1000, 4)}km
        Velocity: ${roundDecimal(velocity, 4)}km/s
        Time (UTC): ${toDateTime(get_render_time()).toISOString().substring(0, 19).replace('T', ' ')}
        Closest Debris Distance: ${Math.round(getClosestDistance())}km
        `
    text.text = info;
}