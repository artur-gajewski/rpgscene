$(document).ready(function() {
  $('.button').on('click', function() {
    $('.content').toggleClass('isOpen');
  });

  screenshotPreview();

  $(function() {
      $( "#accordion" ).accordion({
          heightStyle: "content"
      });
  });
});

var canvas = new fabric.Canvas('c', { selection: true, preserveObjectStacking: true });
var panning = false;
var drawing = false;
var drawingMode = false;
var snap = false;
var grid = 50; // How many pixels is one grid on map
var canvasScale = 1;
var SCALE_FACTOR = 1.01;
var currentX = 100;
var currentY = 100;
var zoomLevel = 0;
var zoomLevelMin = -20;
var zoomLevelMax = 50;
var mouseDownPoint = null;
var currentCanvasId = null;

canvas.setWidth($('#content').width());
canvas.setHeight($('#content').height());

bindActionListeners();

canvas.on('mouse:down', function(event) {
    var pointer = canvas.getPointer(event.e);
    currentX = pointer.x;
    currentY = pointer.y;
    if (!drawingMode && !canvas.getActiveObject() && !canvas.getActiveGroup()) {
        canvas.selection = false;
        panning = true;
    }
});

canvas.on('mouse:up', function() {
    if (!canvas.getActiveObject()) {
        canvas.selection = true;
        panning = false;
    }
}).on('mouse:move', function (e) {
    if (panning && e && e.e) {
        var units = 10;
        var delta = new fabric.Point(e.e.movementX, e.e.movementY);
        canvas.relativePan(delta);
    }
    var pointer = canvas.getPointer(e.e);
    var distance = calculateDistace(pointer.x, pointer.y, currentX, currentY);
    $("#distance").text("Distance: " + ((distance / grid).toFixed(1) * 5) + " feet");
}).on('object:moving', function(options) {
  if (snap) {
    options.target.set({
      left: Math.round(options.target.left / grid) * grid,
      top: Math.round(options.target.top / grid) * grid
    });
  } else {
    options.target.set({
      left: Math.round(options.target.left / 1) * 1,
      top: Math.round(options.target.top / 1) * 1
    });
  }
});

function bindActionListeners() {

    // Clear selections on right click
    $('#content').bind('contextmenu', function (event) {
        event.preventDefault();
        if (canvas.getActiveObject()) {
            canvas.discardActiveObject();
            canvas.renderAll();
        }
        if (canvas.getActiveGroup()) {
            canvas.discardActiveGroup();
            canvas.renderAll();
        }
    });

    // Chrome, Opera, IE scroll wheel zoom
    $("#content").bind('mousewheel', function(event) {
        event.preventDefault();
        var delta = event.originalEvent.wheelDelta;
        if (delta != 0) {
            var pointer = canvas.getPointer(event.e, true);
            var point = new fabric.Point(pointer.x, pointer.y);
            if (delta > 0) {
                zoomIn(point);
            } else if (delta < 0) {
                zoomOut(point);
            }
        }
    });

    // Hack for Firefox in order to make scroll wheel zoom work
    $("#content").bind('DOMMouseScroll', function(event) {
        event.preventDefault();
        var point = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
        if(event.originalEvent.detail > 0) {
             zoomOut(point);
         }else {
             zoomIn(point);
         }
    });

    // Observe if text editing mode is on, disable key events
    canvas.observe('text:editing:entered', function() {
        panning = false;
        $(document).off();
    });

    // Observe if text editing mode is exited, enable key events
    canvas.observe('text:editing:exited', function() {
        panning = false;
        bindActionListeners();
    });

    $(document).bind('keyup', function(event) {

        if (canvas.getActiveGroup()) {
            // Group objects
            if ( event.which == 71 && event ) {
                event.preventDefault();
                groupObjects();
            }
        }

        if (canvas.getActiveObject()) {
            // Ungroup objects
            if ( event.which == 85 && event ) {
                event.preventDefault();
                unGroupObjects();
            }

            // Lock object
            if ( event.which == 76 && event ) {
                event.preventDefault();
                lockObject();
            }

            // Open object
            if ( event.which == 79 && event ) {
                event.preventDefault();
                openObject();
            }

            // Rotate object
            if ( event.which == 82 && event ) {
                event.preventDefault();
                var curAngle = canvas.getActiveObject().getAngle();
                canvas.getActiveObject().setAngle(curAngle+45);
                canvas.renderAll();
            }

            // Left arrow key
            if ( event.which == 37 && event ) {
                event.preventDefault();
                canvas.getActiveObject().left -= grid;
                canvas.getActiveObject().setCoords();
                canvas.renderAll();
            }

            // Right arrow key
            if ( event.which == 39 && event ) {
                event.preventDefault();
                canvas.getActiveObject().left += grid;
                canvas.getActiveObject().setCoords();
                canvas.renderAll();
            }

            // Up arrow key
            if ( event.which == 38 && event ) {
                event.preventDefault();
                canvas.getActiveObject().top -= grid;
                canvas.getActiveObject().setCoords();
                canvas.renderAll();
            }

            // Down arrow key
            if ( event.which == 40 && event ) {
                event.preventDefault();
                canvas.getActiveObject().top += grid;
                canvas.getActiveObject().setCoords();
                canvas.renderAll();
            }
        }

        // Remove active object and object groups
        if ( (event.which == 46 || event.which == 68) && event) {
            event.preventDefault();
            var activeObject = canvas.getActiveObject();
            var activeGroup = canvas.getActiveGroup();
            if (activeObject) {
                if (confirm('Are you sure you want to delete this?')) {
                    canvas.remove(activeObject);
                }
            } else if (activeGroup) {
                if (confirm('Are you sure you want to delete these?')) {
                    var objectsInGroup = activeGroup.getObjects();
                    canvas.discardActiveGroup();
                    objectsInGroup.forEach(function(object) {
                    canvas.remove(object);
                    });
                }
            }
        }

        // Toggle measurement
        if ( event.which == 77 && event ) {
            event.preventDefault();
            $("#distance").toggle();
        }

        // Disable panning mode
        if ( event.which == 32 && event ) {
            event.preventDefault();
            panning = false;
        }

        // Clone an object
        if ( event.which == 67 && event ) {
            event.preventDefault();
            if (canvas.getActiveObject()) {
                var object = fabric.util.object.clone(canvas.getActiveObject());
                canvas.add(object);
            }
        }

        // toggle drawing mode
        if ( event.which == 80 && event ) {
            event.preventDefault();
            if (canvas.isDrawingMode == false) {
                panning = false;
                drawingMode = true;
                canvas.isDrawingMode = true;
                canvas.freeDrawingBrush.color = 'Red';
                canvas.freeDrawingBrush.width = 5;
            } else {
                panning = false;
                drawingMode = false;
                canvas.isDrawingMode = false;
            }
        }

        // Enable panning mode
        if ( event.which == 32 && event ) {
            event.preventDefault();
            panning = true;
        }

        // Enable snap
        if ( event.which == 83 && event ) {
            event.preventDefault();
            snap = snap != true;
        }

        // Bring active object to front
        if ( event.which == 70 && event ) {
            event.preventDefault();
            canvas.getActiveObject().bringToFront();
            canvas.discardActiveObject();
            canvas.renderAll();
        }

        // Bring active object to back
        if ( event.which == 66 && event ) {
            event.preventDefault();
            canvas.getActiveObject().sendToBack();
            canvas.discardActiveObject();
            canvas.renderAll();
        }

        // Bring active object forward
        if ( event.which == 81 && event ) {
            event.preventDefault();
            canvas.getActiveObject().bringForward();
            canvas.discardActiveObject();
            canvas.renderAll();
        }

        // Send active object backwards
        if ( event.which == 65 && event ) {
            event.preventDefault();
            canvas.getActiveObject().sendBackwards();
            canvas.discardActiveObject();
            canvas.renderAll();
        }

        // Zoom in one level
        if ( event.which == 90 && event ) {
            event.preventDefault();
            var point = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
            zoomIn(point);
        }

        // Zoom out one level
        if ( event.which == 88 && event ) {
            event.preventDefault();
            var point = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
            zoomOut(point);
        }
    });
}

function zoomIn(point) {
    if (zoomLevel < zoomLevelMax) {
        zoomLevel++;
        canvas.zoomToPoint(point, Math.pow(1.1, zoomLevel));
        keepPositionInBounds(canvas);
    }
}

function zoomOut(point) {
    if (zoomLevel > zoomLevelMin) {
        zoomLevel--;
        canvas.zoomToPoint(point, Math.pow(1.1, zoomLevel));
        keepPositionInBounds(canvas);
    }
}

function calculateDistace(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2*1-x1*1, 2)+Math.pow(y2*1-y1*1, 2));
}

function keepPositionInBounds() {
    var zoom = canvas.getZoom();
    var xMin = (2 - zoom) * canvas.getWidth() / 2;
    var xMax = zoom * canvas.getWidth() / 2;
    var yMin = (2 - zoom) * canvas.getHeight() / 2;
    var yMax = zoom * canvas.getHeight() / 2;

    var point = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
    var center = fabric.util.transformPoint(point, canvas.viewportTransform);

    canvas.relativePan(new fabric.Point(0, 0));
}

function lockObject() {
   var activeObject = canvas.getActiveObject();
   if (activeObject) {
       activeObject.set({
           "lockMovementX": true,
           "lockMovementY": true,
           "lockScalingX": true,
           "lockScalingY": true,
           "lockRotation": true
       });
       canvas.renderAll();
   }
};

function openObject() {
   var activeObject = canvas.getActiveObject();
   if (activeObject) {
       activeObject.set({
           "lockMovementX": false,
           "lockMovementY": false,
           "lockScalingX": false,
           "lockScalingY": false,
           "lockRotation": false
       });
       canvas.renderAll();
   }
};

function groupObjects() {
    var activegroup = canvas.getActiveGroup();
    if (activegroup) {
        var objectsInGroup = activegroup.getObjects();
        activegroup.clone(function(newgroup) {
            canvas.discardActiveGroup();
            objectsInGroup.forEach(function(object) {
              canvas.remove(object);
            });
            canvas.add(newgroup);
            canvas.renderAll();
        });
    }
};

function unGroupObjects() {
   var activeObject = canvas.getActiveObject();
   if (activeObject) {
     if(activeObject.type=="group"){
        var items = activeObject._objects;
        activeObject._restoreObjectsState();
        canvas.remove(activeObject);
        for(var i = 0; i < items.length; i++) {
          canvas.add(items[i]);
          canvas.item(canvas.size()-1).hasControls = true;
        }
        canvas.renderAll();
      }
    }
};

function addImage(url, width) {
    $("body").addClass("loading");

    fabric.Image.fromURL(url, function (oImg) {
        canvas.add(oImg.scaleToWidth(width));
        canvas.renderAll();
        $("body").removeClass("loading");

    }, {"left": currentX, "top": currentY});
}

function addText(text, size) {
    var text = new fabric.IText(" " + text +" ", { textBackgroundColor: '#fff', shadow: 'rgba(0,0,0,0.3) 5px 5px 5px', fontSize: size, left: currentX, top: currentY });
    canvas.add(text);
}

function addBlindBox() {
    var rect = new fabric.Rect({
      left: currentX,
      top: currentY,
      fill: 'black',
      width: 100,
      height: 100
    });
    canvas.add(rect);
    rect.bringToFront();
}

function addBlindCircle() {
    var circle = new fabric.Circle({
        left: currentX,
        top: currentY,
        fill: 'black',
        radius: 50,
    });
    canvas.add(circle);
    circle.bringToFront();
}

function loadMap(url) {
    $("body").addClass("loading");

    fabric.Image.fromURL(url, function(oImg){
        canvas.setBackgroundImage(oImg, canvas.renderAll.bind(canvas), {
            backgroundImageOpacity: 0.5,
            backgroundImageStretch: false
        });
        $("body").removeClass("loading");
    });

    canvas.setWidth($('#content').width());
    canvas.setHeight($('#content').height());
}

function saveAsPng() {
    window.open(canvas.toDataURL('png'));
}

function saveSceneDialog() {
    var json = JSON.stringify( canvas.toJSON() );
    var sceneStorage = window.localStorage;
    var sceneId = Math.floor(100000 + Math.random() * 900000)
    sceneStorage.setItem(sceneId, json);

  $('<form><input id="sceneid" type="text" style="z-index:10000; width: 50%" name="sceneid" value="' + sceneId + '"><br></form>').dialog({
      modal: true,
      title: "Scene was saved. Refer to the following ID to load it again!",
      width: "50%",
      maxWidth: "600px",
      buttons: {
          'OK': function () {
              bindActionListeners();
              $(this).dialog('close');
              $(this).dialog('destroy');
          }
      }
  });

    $(document).off();

    $(document).bind('keypress', function(event) {
        // Disable Enter key press
        if ( event.which == 13 && event ) {
            event.preventDefault();
        }
    });
}

function loadSceneDialog() {
    var sceneStorage = window.localStorage;

    $('<form><input id="sceneid" type="text" style="z-index:10000; width: 50%" name="sceneid"><br></form>').dialog({
        modal: true,
        title: "Enter scene ID",
        width: "50%",
        maxWidth: "600px",
        buttons: {
            'OK': function () {
                var sceneId = $('input[name="sceneid"]').val();

                bindActionListeners();
                $(this).dialog('close');
                $(this).dialog('destroy');

                var json = sceneStorage.getItem(sceneId);

                canvas.loadFromJSON(json);
                canvas.renderAll();
                //canvas.calculateOffset();

            },
            'Cancel': function () {
                bindActionListeners();
                $(this).dialog('close');
                $(this).dialog('destroy');
            }
        }
    });

    $(document).off();

    $(document).bind('keydown', function(event) {
        // Disable Enter key press
        if ( event.which == 13 && event ) {
            event.preventDefault();
        }
    });
}

function openMapDialog() {
    $('<form><br/><input id="mapurl" type="text" style="z-index:10000; width: 90%" name="url"><br></form>').dialog({
        modal: true,
        title: "Enter map URL",
        width: "50%",
        maxWidth: "600px",
        buttons: {
            'OK': function () {
                var url = $('input[name="url"]').val();
                loadMap(url);
                bindActionListeners();
                $(this).dialog('close');
                $(this).dialog('destroy');
            },
            'Cancel': function () {
                bindActionListeners();
                $(this).dialog('close');
                $(this).dialog('destroy');
            }
        }
    });

    $(document).off();

    $(document).bind('keydown', function(event) {
        // Disable Enter key press
        if ( event.which == 13 && event ) {
            event.preventDefault();
        }
    });
}

function openImageDialog() {
    $('<form><br/><input id="mapurl" type="text" style="z-index:10000; width: 90%" name="url"><br></form>').dialog({
        modal: true,
        title: "Enter image URL",
        width: "50%",
        maxWidth: "600px",
        buttons: {
            'OK': function () {
                var url = $('input[name="url"]').val();
                addImage(url, grid);
                bindActionListeners();
                $(this).dialog('close');
                $(this).dialog('destroy');
            },
            'Cancel': function () {
                bindActionListeners();
                $(this).dialog('close');
                $(this).dialog('destroy');
            }
        }
    });

    $(document).off();

    $(document).bind('keydown', function(event) {
        // Disable Enter key press
        if ( event.which == 13 && event ) {
            event.preventDefault();
        }
    });
}

function openTextInputDialog() {
    $('<form><br/><input type="text" style="z-index:10000; width: 90%" name="maptext"><br></form>').dialog({
        modal: true,
        title: "Enter text",
        width: "50%",
        maxWidth: "600px",
        buttons: {
            'OK': function () {
                var text = $('input[name="maptext"]').val();
                addText(text, 20);
                bindActionListeners();
                $(this).dialog('close');
                $(this).dialog('destroy');
            },
            'Cancel': function () {
                bindActionListeners();
                $(this).dialog('close');
                $(this).dialog('destroy');
            }
        }
    });

    $(document).off();

    $(document).bind('keydown', function(event) {
        // Disable Enter key press
        if ( event.which == 13 && event ) {
            event.preventDefault();
        }
    });
}

function openHelpDialog() {
    $('#help-dialog').dialog({
        modal: true,
        title: "Key mappings and help",
        width: "50%",
        maxWidth: "600px",
        buttons: {
            'OK': function () {
                $(this).dialog('close');
            }
        }
    });
}

function openCreditsDialog() {
    $('#credits-dialog').dialog({
        modal: true,
        title: "Credits",
        width: "50%",
        maxWidth: "600px",
        buttons: {
            'OK': function () {
                $(this).dialog('close');
            }
        }
    });
}

/*
 * Url preview script
 * powered by jQuery (http://www.jquery.com)
 *
 * written by Alen Grakalic (http://cssglobe.com)
 *
 * for more info visit http://cssglobe.com/post/1695/easiest-tooltip-and-image-preview-using-jquery
 *
 */
this.screenshotPreview = function(){
    xOffset = 10;
    yOffset = 30;
    $("a.screenshot").hover(function(e){
        this.t = this.title;
        this.title = "";
        var c = (this.t != "") ? "<br/>" + this.t : "";
        $("body").append("<p id='screenshot'><img width='200' src='"+ this.rel +"' alt='url preview' />"+ c +"</p>");
        $("#screenshot")
            .css("top",(e.pageY - xOffset) + "px")
            .css("left",(e.pageX + yOffset) + "px")
            .fadeIn("fast");
    },
    function(){
        this.title = this.t;
        $("#screenshot").remove();
    });

    $("a.screenshot").mousemove(function(e) {
        $("#screenshot")
            .css("top",(e.pageY - xOffset) + "px")
            .css("left",(e.pageX + yOffset) + "px");
    });
};
