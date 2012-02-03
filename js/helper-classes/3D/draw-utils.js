/* <copyright>
This file contains proprietary software owned by Motorola Mobility, Inc.<br/>
No rights, expressed or implied, whatsoever to this software are provided by Motorola Mobility, Inc. hereunder.<br/>
(c) Copyright 2011 Motorola Mobility, Inc.  All Rights Reserved.
</copyright> */

///////////////////////////////////////////////////////////////////////
// Class DrawUtils
//      Overlay drawing utility functions
///////////////////////////////////////////////////////////////////////
var Montage = require("montage/core/core").Montage,
    Component = require("montage/ui/component").Component;

var vecUtils = require("js/helper-classes/3D/vec-utils").VecUtils;
var Rectangle = require("js/helper-classes/3D/rectangle").Rectangle;
var StageLine = require("js/helper-classes/3D/StageLine").StageLine;


var DrawUtils = exports.DrawUtils = Montage.create(Component, {

	///////////////////////////////////////////////////////////////////////
	// Instance variables
	///////////////////////////////////////////////////////////////////////
    viewUtils: { value: null, writable: true },
    snapManager: { value: null },
    ElementPlanes : { value: null, writable: true },

	// the drawing surface (a canvas)
	_drawingSurfaceElt : { value: null, writable: true },
	_drawingContext : { value: null, writable: true },

	// color to draw the lines
	_lineColor : { value: "black", writable: true},

	// define a stack for quickly setting graphics states and restoring them
	_stateArray : { value: [], writable: true },

	// save references to the grid lines for quick redraw
	_gridLineArray : {value: [], writable: true },

	// state for moveTo, lineTo
	_curPt : { value: null, writable: true },
	_curVis : { value: null, writable: true },

	// the element that defines the coordinate system for the displayed lines
	_sourceSpaceElt  : { value: null, writable: true },

	// maintain a list of objects to hide against
	_eltArray : {value: [], writable: true },

	// maintain a list of the planes to test against
	_planesArray : {value: [], writable: true },

	// the working plane.
	// a grid may be drawn aligned with this working plane
	_workingPlane : { value: null, writable: true },

	// save some parameters about the grid.
	// these parameters are set when the grid is drawn
	_gridHorizontalSpacing : {value: 50, writable: true },
	_gridVerticalSpacing : {value: 50, writable: true },
	_gridHorizontalLineCount : {value:10, writable: true },
	_gridVerticalLineCount : {value:0, writable: true },
	_gridOrigin : {value: null, writable: true },

	drawXY : {value: false, writable: true },
	drawXZ : {value: false, writable: true },
	drawYZ : {value: false, writable: true },

	drawElementN : {value: false, writable: true },

	_selectionCtr : {value: null, writable: true },

	///////////////////////////////////////////////////////////////////////
	// Property accessors
	///////////////////////////////////////////////////////////////////////
	setDrawingSurfaceElement : { value: function( s ) {  this._drawingSurfaceElt = s;  if (s)  this._drawingContext = s.getContext("2d");     }},
	getDrawingSurfaceElement : { value: function()          {  return this._drawingSurfaceElt;      }},

	getDrawingContext : { value: function()			{  return this._drawingContext;			}},

	setSourceSpaceElement : { value: function(ss)          {  this._sourceSpaceElt = ss;           }},
	getSourceSpaceElement : { value: function()            {  return this._sourceSpaceElt;         }},

	getWorkingPlane : { value: function()            {  return this._workingPlane;           }},
	setWorkingPlane : { value: function (wp)			{ this._workingPlane = wp;				}},

	getGridHorizontalSpacing : { value: function()	{  return this._gridHorizontalSpacing;		}},
	getGridVerticalSpacing : { value: function()	{  return this._gridVerticalSpacing;		}},
	getGridHorizontalLineCount : { value: function()	{  return this._gridHorizontalLineCount;	}},
	getGridVerticalLineCount : { value: function()	{  return this._gridVerticalLineCount;	}},
	getGridOrigin : { value: function()	{  return this._gridOrigin.slice(0);			}},

	isDrawingGrid : { value: function()			{  return this.drawXY || this.drawYZ || this.drawXZ;	}},
	isDrawingElementNormal : { value: function()			{  return this.drawElementN	}},

	getLineColor : { value: function()			{  return this._lineColor;					}},
	setLineColor : { value: function( color )		{  this._lineColor = color;					}},

	getLineWidth : { value: function()			{  return this._drawingContext.lineWidth;	}},
	setLineWidth : { value: function( w )			{  this._drawingContext.lineWidth = w;		}},


	initialize: {
		value: function() {
			this._gridOrigin = [0,0];	// 2D plane space point

            this.eventManager.addEventListener("elementAdded", this, false);
            this.eventManager.addEventListener("elementDeleted", this, false);
            this.eventManager.addEventListener("elementChange", this, false);
		}
	},

    handleElementAdded: {
        value: function(event) {
            this.addElement(event.detail);
            this.drawWorkingPlane();
        }
    },

    handleElementDeleted: {
        value: function(event) {
            this.removeElement(event.detail);
        }
    },


    handleElementChange: {
        value: function(event) {
            var els = event.detail.data.els;
            if(els)
            {
                var len = els.length,
                    i = 0,
                    item,
                    el;

                for(i=0; i < len; i++) {
                    item = els[i];
                    el = item._element || item;
                    el.elementModel.props3D.elementPlane.init();
                }

                this.drawWorkingPlane();
            }
        }
    },

	///////////////////////////////////////////////////////////////////////
	// Methods
	///////////////////////////////////////////////////////////////////////

	addElement:
	{
		value: function( elt )
		{
			// check if we already know about this object
			var n = this._eltArray.length;
			for (var i=0;  i<n;  i++)
			{
				if (elt == this._eltArray[i])
				{
//					console.log( "element already added to stage display: " + elt.id );
					return;
				}
			}

			this._eltArray.push( elt );

			// create the planes for this element
			var plane = Object.create(this.ElementPlanes, {});
			plane.setElement( elt );
			plane.init();
			this._planesArray.push( plane );
            elt.elementModel.props3D.elementPlane = plane;
		}
	},

	removeElement : {
		value: function( elt ) {
			// check if object exists
			var n = this._eltArray.length;
			for (var i=0;  i<n;  i++)
			{
				if (elt == this._eltArray[i])
				{
					// First remove the planes for this element
					this._planesArray.splice(i, 1);

					// Then remove the element
					this._eltArray.splice(i, 1);

                    // TODO - May need to delete props3D and elementPlane as well
					return;
				}
			}
		}
	},

	clear : {
		value: function() {
			if (this._drawingContext)
				this._drawingContext.clearRect( 0, 0, this._drawingSurfaceElt.width,  this._drawingSurfaceElt.height );
		}
	},

	updatePlanes : {
		value: function() {
			var n = this._planesArray.length;

			for (var i=0;  i<n;  i++)
			{
				var plane = this._planesArray[i];
				plane.init();
			}
		}
	},

	getVisibilityAtPoint:
	{
		value: function( targetPt )
		{
			// duplicate the point and make sure it has the correct dimension (2)
			var pt = targetPt.slice(0);
			while (pt.length > 3)  pt.pop();

			var z = pt[2];
			var n = this._planesArray.length;
			var vis = 0;
			for (var i=0;  i<n;  i++)
			{
				var plane = this._planesArray[i];

				// ignore if the point is in front of the polygon
				if (z > plane.getZMax())  continue;

				// test for containment in the polygon bounds
				var contain = MathUtils.boundaryContainsPoint( plane.getBoundaryPoints(),  pt,  plane.isBackFacing() );
				if (contain == MathUtils.OUTSIDE)  continue;
				if (contain == MathUtils.ON)       continue;

				// shoot a ray from the point in the +Z direction to get the z value of the plane
				var vec = [0,0,1];
				var planeEq = plane.getPlaneEq();
				var ptOnPlane = MathUtils.vecIntersectPlane( pt, vec, planeEq );
				if (ptOnPlane)
				{
					// in keeping with the convention that a point "on" a face is outside the element,
					// check that case.
					//if (MathUtils.fpCmp(pt[2], ptOnPlane[2]) == 0)  continue;

					// if the point is behind the plane, increase the visibility
					if (MathUtils.fpCmp(pt[2],ptOnPlane[2]) <= 0)  vis++;
				}
			}

			return vis;
		}
	},

	moveTo : {
		value: function( pt ) {
			if (this._sourceSpaceElt)
				pt = this.viewUtils.localToGlobal( pt, this._sourceSpaceElt );

			this._curPt = pt.slice(0);
			this._curVis = this.getVisibilityAtPoint( pt );
		}
	},

	lineTo :
	{
		value: function( pt )
		{
			if (this._sourceSpaceElt)
				pt = this.viewUtils.localToGlobal( pt, this._sourceSpaceElt );

			var line = Object.create(StageLine, {});
			line.setPoints( this._curPt, pt );
			line.setVisibility( this._curVis );

			// find all the plane intersections
			this.getLineIntersections( line );

			// draw the line
			this._curVis = this.drawIntersectedLine( line, this._drawingContext );
			this._curPt = pt.slice(0);
		}
	},


	drawLine :
	{
		value: function( pt0, pt1 )
		{
			if (this._drawingContext)
			{
				// transform the points from local object space to world space
				if (this._sourceSpaceElt)
				{
					pt0 = this.viewUtils.localToGlobal( pt0, this._sourceSpaceElt );
					pt1 = this.viewUtils.localToGlobal( pt1, this._sourceSpaceElt );
				}

				// create the line structure
				var line = Object.create(StageLine, {});
				line.setPoints( pt0, pt1 );

				// find all the plane intersections
				this.getLineIntersections( line );

				// get the starting visibility
				var vis = this.getVisibilityAtPoint( pt0 );
				line.setVisibility( vis );

				// draw the line
				this._curVis = this.drawIntersectedLine( line, this._drawingContext );
			}
		}
	},

	drawIntersectedLine :
	{
		value: function( line )
		{
			this._drawingContext.strokeStyle = this._lineColor;
			this._drawingContext.beginPath();

			//  get the 2 enpoints of the line
			var pt0 = line.getPoint0(),
				pt1 = line.getPoint1();

			// find the visibility at the start point
			var vis = line.getVisibility();
			if (vis == 0)
			{
				this._drawingContext.strokeStyle = this._lineColor;
				this._drawingContext.beginPath();
				this._drawingContext.moveTo( pt0[0], pt0[1] );
			}

			// go through each intersection
			var n = line.getIntersectionCount();
			var t = 0.0;
			var iRec = line.getIntersectionList();
			for (var i=0;  i<n;  i++)
			{
				var tNext = iRec.getT();
				var dv = iRec.getDeltaVis();

				var tPt = MathUtils.interpolateLine3D( pt0, pt1, tNext );

				if (vis == 0)
				{
					this._drawingContext.lineTo( tPt[0], tPt[1] );
					this._drawingContext.closePath();
					this._drawingContext.stroke();
				}
				else
				{
					this._drawingContext.beginPath();
					this._drawingContext.moveTo( tPt[0], tPt[1] );
				}

				vis += dv;
				iRec = iRec.getNext();
			}

			// handle the end of the line
			if (vis == 0)
			{
				this._drawingContext.lineTo( pt1[0], pt1[1] );

				// draw the line
				this._drawingContext.closePath();
				this._drawingContext.stroke();
			}

			return vis;
		}
	},

	getLineIntersections:
	{
		value: function( line )
		{
			// clip the line against all polygons in the scene
			var n = this._planesArray.length;
			for (var i=0;  i<n;  i++)
			{
				var plane = this._planesArray[i];
				line.intersectWithPlane( plane );
			}
		}
	},

	getPlaneToWorldMatrix:
	{
		value: function (normal, ptOnPlane)
		{
			// 3 coordinate axes for the plane
			var zAxis = normal.slice(0);
			MathUtils.makeDimension3(zAxis);
			zAxis = vecUtils.vecNormalize(3, zAxis);

			// special case the coordinate axes followed by general case
			var tmp;
			var xAxis, yAxis;
			if (MathUtils.fpCmp(Math.abs(zAxis[0]), 1.0) == 0) {
				yAxis = [0, 1, 0];
				xAxis = vecUtils.vecCross(3, yAxis, zAxis);
			}
			else if (MathUtils.fpCmp(Math.abs(zAxis[1]), 1.0) == 0) {
				yAxis = [0, 0, 1];
				//xAxis = yAxis.cross(zAxis);
				xAxis = vecUtils.vecCross(3, yAxis, zAxis );
			}
			else if (MathUtils.fpCmp(Math.abs(zAxis[2]), 1.0) == 0) {
				yAxis = [0, 1, 0];
				//xAxis = yAxis.cross(zAxis);
				xAxis = vecUtils.vecCross(3, yAxis, zAxis );
			}
			else
			{
				if (Math.abs(zAxis[0]) < Math.abs(zAxis[1]))
				{
					if (Math.abs(zAxis[0]) < Math.abs(zAxis[2]))
						tmp = [1, 0, 0];
					else
						tmp = [0, 0, 1];
				}
				else
				{
					if (Math.abs(zAxis[1]) < Math.abs(zAxis[2]))
						tmp = [0, 1, 0];
					else
						tmp = [0, 0, 1];
				}
				//xAxis = tmp.cross(zAxis);
				xAxis = vecUtils.vecCross(3, tmp, zAxis);
				//yAxis = zAxis.cross(xAxis);
				yAxis = vecUtils.vecCross(3, zAxis, xAxis);
			}

			// create the matrix
			var mat = Matrix.create(
				[
					[xAxis[0], yAxis[0], zAxis[0], ptOnPlane[0]],
					[xAxis[1], yAxis[1], zAxis[1], ptOnPlane[1]],
					[xAxis[2], yAxis[2], zAxis[2], ptOnPlane[2]],
					[0, 0, 0, 1]
				]
			);

			return mat;
		}
	},

	clearDefaultGridOffset : {
		value: function() {
			this.setDefaultGridOffset( [0,0,0] );
		}
	},

	drawWorkingPlane:
	{
		value: function ()
		{
			if (!this.isDrawingGrid()) return;

			var saveContext = this.getDrawingSurfaceElement();
			//this.setDrawingSurfaceElement(window.stageManager.layoutCanvas);
			this.setDrawingSurfaceElement(this.application.ninja.stage.layoutCanvas);

			// 3 coordinate axes for the plane
			var zAxis = [this._workingPlane[0], this._workingPlane[1], this._workingPlane[2]];

			// get a point that lies on the plane
			var ptOnPlane = MathUtils.getPointOnPlane(this._workingPlane);

			// get a matrix from working plane space to the world
			var mat = this.getPlaneToWorldMatrix(zAxis, ptOnPlane);
			var tMat = Matrix.Translation( [0.5*this.snapManager.getStageWidth(), 0.5*this.snapManager.getStageHeight(),0] );
			//mat = tMat.multiply(mat);
			glmat4.multiply( tMat, mat, mat);

			// define the grid parameters
			var width = this.snapManager.getStageWidth(),
				height = this.snapManager.getStageHeight();
			var nLines = 10;

			// the positioning of the grid may depend on the view direction.
			var stage = this.snapManager.getStage();
			var viewMat = this.viewUtils.getMatrixFromElement(stage);
			var viewDir = [viewMat[8], viewMat[9], viewMat[10]];

			var dx, dy, delta, pt0, pt1;
			dx = this._gridVerticalSpacing;
			dy = this._gridHorizontalSpacing;
			nLines = Math.floor(width / dx) + 1;
			if (MathUtils.fpCmp(dx*nLines,width) == 0)  nLines--;

			var saveColor = this._lineColor;
			var saveLineWidth = this._drawingContext.lineWidth;

			// reset the line cache
			this._gridLineArray = new Array();

			if (this.drawXY) this._lineColor = "red";
			if (this.drawYZ) this._lineColor = "green";
			if (this.drawXZ) this._lineColor = "blue";
			this._drawingContext.lineWidth = 0.25;

			// get the two endpoints of the first line with constant X
			pt0 = [-width / 2.0, height / 2.0, 0];
			pt1 = [-width / 2.0, -height / 2.0, 0];
			delta = [dx, 0, 0];

			this._gridVerticalLineCount = nLines;
			this._gridOrigin = pt1.slice(0);

			// draw the lines with constant X
			this.drawGridLines(pt0, pt1, delta, mat, nLines);

			// get the two endpoints of the first line with constant Y
			pt0 = [-width / 2.0, -height / 2.0, 0];
			pt1 = [width / 2.0, -height / 2.0, 0];

			delta = [0, dy, 0];
			nLines = Math.floor(height / dy) + 1;
			if (MathUtils.fpCmp(dy*nLines,height) == 0)  nLines--;

			this._gridHorizontalLineCount = nLines;

			// draw the lines with constant Y
			this.drawGridLines(pt0, pt1, delta, mat, nLines);

			this._lineColor = saveColor;
			this._drawingContext.lineWidth = saveLineWidth;

			// draw the lines
			this.redrawGridLines();

			this.setDrawingSurfaceElement(saveContext);
		}
	},

	drawGridLines : {
		value: function (pt0, pt1, delta, mat, nLines) {
			// get the drawing context
			if (this._drawingContext) {
				var p0 = pt0.slice(0), p1 = pt1.slice(0); // duplicate so we don't change the input.
				p0[3] = 1; p1[3] = 1;
				var d = delta.slice(0); d[3] = 1;

				//var lineArray = new Array;
				var offset = this.viewUtils.getElementOffset(this._sourceSpaceElt);
				offset[2] = 0;
				this.viewUtils.setViewportObj(this._sourceSpaceElt);
				for (var i = 0; i < nLines; i++) {
					// transform the points from working plane space to world space
					//var t0 = mat.multiply(p0),
					//	t1 = mat.multiply(p1);
					var t0 = glmat4.multiplyVec3( mat, p0, [] ),
						t1 = glmat4.multiplyVec3( mat, p1, [] );

					// transform from world space to global screen space
					if (this._sourceSpaceElt) {
						t0 = this.viewUtils.localToGlobal(t0, this._sourceSpaceElt);
						t1 = this.viewUtils.localToGlobal(t1, this._sourceSpaceElt);
					}

					// create a line from the endpoints
					var line = Object.create(StageLine, {});
					line.setPoints(t0, t1);
					this._gridLineArray.push(line);

					// find all the intersections
					this.getLineIntersections(line);

					// get the visibility at the start point
					var vis = this.getVisibilityAtPoint(line.getPoint0());
					line.setVisibility(vis);

					// increment the points to the next position
//					p0 = p0.add(d); p0[3] = 1.0;
					p0 = vecUtils.vecAdd(4, p0, d); p0[3] = 1.0;
//					p1 = p1.add(d); p1[3] = 1.0;
					p1 = vecUtils.vecAdd(4, p1, d); p1[3] = 1.0;
				}
			}
		}
	},

	refreshDisplay : {
		value: function() {
			this.redrawGridLines();
			this.snapManager.drawLastHit();
		}
	},

	pushState : {
		value: function() {
			var obj = new Object();
			obj._lineColor = this._lineColor;
			obj._lineWidth = this._drawingContext.lineWidth;

			this._stateArray.push( obj );
		}
	},

	popState  : {
		value: function() {
			if (this._stateArray.length <= 0)
			{
				throw new Error( "state stack underflow" );
				return;
			}

			var obj = this._stateArray.pop();
			this._lineColor = obj._lineColor;
			this._drawingContext.lineWidth = obj._lineWidth;
		}
	},


	redrawGridLines : {
		value: function() {
			if (!this.isDrawingGrid()) return;

			this.pushState();

			if (this.drawXY) this._lineColor = "red";
			if (this.drawYZ) this._lineColor = "green";
			if (this.drawXZ) this._lineColor = "blue";
			this._drawingContext.lineWidth = 0.25;

			// draw the lines
			var nLines = this._gridLineArray.length;
			for (var i = 0; i < nLines; i++) {
				var line = this._gridLineArray[i];
				this.drawIntersectedLine(line, this._drawingContext);
			}

			this.popState();
		}
	},

	drawSelectionBounds : {
		value: function( eltArray ) {
			this._selectionCtr = null;
			
			if (eltArray.length == 0)  return;
			var context = this._drawingContext;
			if (!context)  return;

            // TODO - Get values from app settings
			context.strokeStyle = "#46a1ff";
			context.lineWidth = 2;

			// handle the single element case
			if (eltArray.length == 1)
			{
				// single selection case
				//console.log( "single selection" );

				var elt = eltArray[0];

				this.viewUtils.pushViewportObj( elt );

				// get the element bounds in world space
				var bounds3D = this.viewUtils.getElementViewBounds3D( elt );
				for (var j=0;  j<4;  j++) {
					bounds3D[j] = this.viewUtils.localToGlobal( bounds3D[j],  elt );
				}

				// draw it
				context.beginPath();
				//VV
				context.strokeStyle = "#46a1ff";
				context.lineWidth = 2.0;

				context.moveTo( bounds3D[3][0] ,  bounds3D[3][1] );
				for (var v=0;  v<4;  v++) {
					context.lineTo( bounds3D[v][0] ,  bounds3D[v][1] );
				}
				context.closePath();
				context.stroke();

				this._selectionCtr = MathUtils.getCenterFromBounds(3, bounds3D);
				console.log("selection center, single elt case - ", this._selectionCtr);
				
				this.viewUtils.popViewportObj();
			}
			else
			{
				// the multiple selection case.
				//console.log( "multiple selection" );

				// we set the root to "the world".
				var saveRoot = this.viewUtils.getRootElement();
				this.viewUtils.setRootElement( this.viewUtils.getStageElement() );

				// get the plane from the first element to compare against the other elements
				var flat = true;
				var plane = this.viewUtils.getElementPlane( eltArray[0] );
				for (var i=1;  i<eltArray.length;  i++)
				{
					var elt = eltArray[i];
					var plane2 = this.viewUtils.getElementPlane( elt );
					var dot = MathUtils.dot3(plane,plane2);
					if (MathUtils.fpCmp(dot, 1) != 0)
					{
						flat = false;
						break;
					}

					// check the offset
					var d = plane[3],  d2 = plane2[3];
					if (MathUtils.fpCmp(d,d2) != 0)
					{
						flat = false;
						break;
					}
				}

				// construct a matrix from world space to 'plane' space
				var ptOnPlane = this.viewUtils.localToGlobal( [0,0,0], eltArray[0]);
				var planeToWorld = this.getPlaneToWorldMatrix( plane, ptOnPlane );
				//var worldToPlane = planeToWorld.inverse();
				var worldToPlane = glmat4.inverse(planeToWorld, []);

                var ssMat = this.viewUtils.getLocalToGlobalMatrix( this._sourceSpaceElt );
				// if all the elements share the same plane, draw the 2D rectangle
				if (flat)
				{
					// make a 2D rectangle on the plane
					var rect;
					for (var i=0;  i<eltArray.length;  i++)
					{
						var elt = eltArray[i];

						// get the element bounds in 'plane' space
						var bounds = this.viewUtils.getElementViewBounds3D( elt );
						for (var j=0;  j<4;  j++)
						{
//							var gPt = MathUtils.makeDimension4( this.viewUtils.localToGlobal( bounds[j],  elt ) );
//							//var pt = worldToPlane.multiply( gPt );
//							var pt    = glmat4.multiplyVec3( worldToPlane, gPt, [] );
//							var tmpPt = glmat4.multiplyVec3( planeToWorld,  pt, [] );

                            var localPt = bounds[j];
                            var tmpPt = this.viewUtils.localToGlobal2(localPt, ssMat);
                            var pt = glmat4.multiplyVec3( worldToPlane, tmpPt, [] );

							if (!rect)
							{
								rect = Object.create(Rectangle, {});
								rect.setToPoint( pt )
							}
							else
							{
								rect.unionPoint( pt );
							}
						}
					}

					// restore the rootct
					this.viewUtils.setRootElement (saveRoot );

					// draw the reectangle
					context.beginPath();

					var pt4 = MathUtils.makeDimension4(rect.getPoint(3));
					var viewPt = glmat4.multiplyVec3( planeToWorld, pt4, [] );
					MathUtils.makeDimension3( viewPt );
//					var pt = this.viewUtils.localToGlobal( viewPt, this._sourceSpaceElt );
					var pt = this.viewUtils.localToGlobal2(viewPt, ssMat);

					var bounds3D = [[0,0], [0,0], [0,0], [0,0]];
					this._selectionCtr = pt.slice(0);

					context.moveTo( pt[0],  pt[1] );
					for (var i=0;  i<4;  i++)
					{
						pt4 = MathUtils.makeDimension4(rect.getPoint(i));
						//viewPt = planeToWorld.multiply( pt4 );
						viewPt = glmat4.multiplyVec3( planeToWorld, pt4, [] );
						MathUtils.makeDimension3( viewPt );
//						pt = this.viewUtils.localToGlobal( viewPt, this._sourceSpaceElt );
						pt = this.viewUtils.localToGlobal2( viewPt, ssMat );
						context.lineTo( pt[0],  pt[1] );
						bounds3D[i] = pt.slice(0);
					}
					context.closePath();
					context.stroke();

					var dir = vecUtils.vecSubtract(2, bounds3D[1], bounds3D[3]);
					var ctr = vecUtils.vecNormalize(2, dir, vecUtils.vecDist(2, bounds3D[1], bounds3D[3])/2);

//					this._selectionCtr[0] += ctr[0] - window.stageManager.userContentLeft;
//					this._selectionCtr[1] += ctr[1] - window.stageManager.userContentTop;
					this._selectionCtr[0] += ctr[0] - this.application.ninja.stage.userContentLeft;
					this._selectionCtr[1] += ctr[1] - this.application.ninja.stage.userContentTop;
				}
				else
				{
					var minPt,  maxPt;

					for (var i=0;  i<eltArray.length;  i++)
					{
						var elt = eltArray[i];
						var bounds = this.viewUtils.getElementViewBounds3D( elt );
                        var eltMat = this.viewUtils.getLocalToGlobalMatrix( elt );
						for (var j=0;  j<4;  j++)
						{
							//var pt = worldToPlane.multiply( MathUtils.makeDimension4( this.viewUtils.localToGlobal( bounds[j],  elt )) );
//							var pt = this.viewUtils.localToGlobal( bounds[j],  elt );
							var pt = this.viewUtils.localToGlobal2( bounds[j],  eltMat );
							if (!minPt)
							{
								minPt = pt.slice(0);
								maxPt = pt.slice(0);
							}
							else
							{
								var x = pt[0],  y = pt[1], z = pt[2];

								if (x < minPt[0])    minPt[0] = x;
								if (x > maxPt[0])    maxPt[0] = x;

								if (y < minPt[1])    minPt[1] = y;
								if (y > maxPt[1])    maxPt[1] = y;

								if (z < minPt[2])    minPt[2] = z;
								if (z > maxPt[2])    maxPt[2] = z;
							}
						}
					}

					// restore the root ID
					this.viewUtils.setRootElement (saveRoot );

					context.beginPath();

					var x0 = minPt[0],  y0 = minPt[1],  z0 = minPt[2],
						x1 = maxPt[0],  y1 = maxPt[1],  z1 = maxPt[2];

					this._selectionCtr = [x0, y0, z0];
					this._selectionCtr[0] += (x1-x0)/2;
					this._selectionCtr[1] += (y1-y0)/2;
					this._selectionCtr[2] += (z1-z0)/2;

					// get the 8 corners of the parallelpiped in world space
					var wc = new Array();   // wc == world cube
//					wc.push(  this.viewUtils.localToGlobal( [x0,y0,z1], this._sourceSpaceElt ) );
//					wc.push(  this.viewUtils.localToGlobal( [x0,y1,z1], this._sourceSpaceElt ) );
//					wc.push(  this.viewUtils.localToGlobal( [x1,y1,z1], this._sourceSpaceElt ) );
//					wc.push(  this.viewUtils.localToGlobal( [x1,y0,z1], this._sourceSpaceElt ) );
//					wc.push(  this.viewUtils.localToGlobal( [x0,y0,z0], this._sourceSpaceElt ) );
//					wc.push(  this.viewUtils.localToGlobal( [x0,y1,z0], this._sourceSpaceElt ) );
//					wc.push(  this.viewUtils.localToGlobal( [x1,y1,z0], this._sourceSpaceElt ) );
//					wc.push(  this.viewUtils.localToGlobal( [x1,y0,z0], this._sourceSpaceElt ) );

                    wc.push(  this.viewUtils.localToGlobal2( [x0,y0,z1], ssMat ) );
					wc.push(  this.viewUtils.localToGlobal2( [x0,y1,z1], ssMat ) );
					wc.push(  this.viewUtils.localToGlobal2( [x1,y1,z1], ssMat ) );
					wc.push(  this.viewUtils.localToGlobal2( [x1,y0,z1], ssMat ) );
					wc.push(  this.viewUtils.localToGlobal2( [x0,y0,z0], ssMat ) );
					wc.push(  this.viewUtils.localToGlobal2( [x0,y1,z0], ssMat ) );
					wc.push(  this.viewUtils.localToGlobal2( [x1,y1,z0], ssMat ) );
					wc.push(  this.viewUtils.localToGlobal2( [x1,y0,z0], ssMat ) );

					// determine the signs of the normals of the faces relative to the view direction.
					//var front   = -MathUtils.fpSign(  MathUtils.cross(wc[2].subtract(wc[1]), wc[0].subtract(wc[1]))[2] ),
					var front	= -MathUtils.fpSign( vecUtils.vecCross(3, vecUtils.vecSubtract(3,wc[2],wc[1]), vecUtils.vecSubtract(3,wc[0],wc[1]))[2] ),
						//right   = -MathUtils.fpSign(  MathUtils.cross(wc[6].subtract(wc[2]), wc[3].subtract(wc[2]))[2] ),
						right   = -MathUtils.fpSign( vecUtils.vecCross(3, vecUtils.vecSubtract(3,wc[6],wc[2]), vecUtils.vecSubtract(3,wc[3],wc[2]))[2] ),
						//back    = -MathUtils.fpSign(  MathUtils.cross(wc[5].subtract(wc[6]), wc[7].subtract(wc[6]))[2] ),
						back    = -MathUtils.fpSign( vecUtils.vecCross(3, vecUtils.vecSubtract(3,wc[5],wc[6]), vecUtils.vecSubtract(3,wc[7],wc[6]))[2] ),
						//left    = -MathUtils.fpSign( MathUtils.cross(wc[1].subtract(wc[5]), wc[4].subtract(wc[5]))[2] ),
						left    = -MathUtils.fpSign( vecUtils.vecCross(3, vecUtils.vecSubtract(3,wc[1],wc[5]), vecUtils.vecSubtract(3,wc[4],wc[5]))[2] ),
						//top     = -MathUtils.fpSign( MathUtils.cross(wc[3].subtract(wc[0]), wc[4].subtract(wc[0]))[2] ),
						top     = -MathUtils.fpSign( vecUtils.vecCross(3, vecUtils.vecSubtract(3,wc[3],wc[0]), vecUtils.vecSubtract(3,wc[4],wc[0]))[2] ),
						//bottom  = -MathUtils.fpSign( MathUtils.cross(wc[5].subtract(wc[1]), wc[2].subtract(wc[1]))[2] );
						bottom  = -MathUtils.fpSign( vecUtils.vecCross(3, vecUtils.vecSubtract(3,wc[5],wc[1]), vecUtils.vecSubtract(3,wc[2],wc[1]))[2] );

					// draw the side faces
					var p;

					//context.strokeStyle = ((front > 0) || (right > 0)) ? dark : light;  context.beginPath();
					if ((front > 0) || (right > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x1, y0, z1], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x1, y1, z1], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y0, z1], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y1, z1], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					//context.strokeStyle = ((right > 0) || (back > 0)) ? dark : light;  context.beginPath();
					if ((right > 0) || (back > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x1, y0, z0], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x1, y1, z0], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
                        p = this.viewUtils.localToGlobal2( [x1, y0, z0], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y1, z0], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					//context.strokeStyle = ((back > 0) || (left > 0)) ? dark : light;  context.beginPath();
					if ((back > 0) || (left > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x0, y0, z0], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x0, y1, z0], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y0, z0], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y1, z0], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					//context.strokeStyle = ((left > 0) || (front > 0)) ? dark : light;  context.beginPath();
					if ((left > 0) || (front > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x0, y0, z1], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x0, y1, z1], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y0, z1], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y1, z1], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					// draw the top and bottom faces
					//context.strokeStyle = ((front > 0) || (top > 0)) ? dark : light;  context.beginPath();
					if ((front > 0) || (top > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x0, y0, z1], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x1, y0, z1], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y0, z1], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y0, z1], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					//context.strokeStyle = ((top > 0) || (back > 0)) ? dark : light;  context.beginPath();
					if ((top > 0) || (back > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x0, y0, z0], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x1, y0, z0], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y0, z0], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y0, z0], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					//context.strokeStyle = ((back > 0) || (bottom > 0)) ? dark : light;  context.beginPath();
					if ((back > 0) || (bottom > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x0, y1, z0], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x1, y1, z0], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y1, z0], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y1, z0], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					//context.strokeStyle = ((bottom > 0) || (front > 0)) ? dark : light;  context.beginPath();
					if ((bottom > 0) || (front > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x0, y1, z1], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x1, y1, z1], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y1, z1], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y1, z1], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					// and the remaining lines - varying Z
					if ((top > 0) || (right > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x1, y0, z0], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x1, y0, z1], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y0, z0], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y0, z1], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					//context.strokeStyle = ((right > 0) || (bottom > 0)) ? dark : light;  context.beginPath();
					if ((right > 0) || (bottom > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x1, y1, z0], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x1, y1, z1], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y1, z0], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x1, y1, z1], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					//context.strokeStyle = ((bottom > 0) || (left > 0)) ? dark : light;  context.beginPath();
					if ((bottom > 0) || (left > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x0, y1, z0], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x0, y1, z1], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y1, z0], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y1, z1], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}

					//context.strokeStyle = ((left > 0) || (top > 0)) ? dark : light;  context.beginPath();
					if ((left > 0) || (top > 0)) {
						context.beginPath();
//						p = this.viewUtils.localToGlobal( [x0, y0, z0], this._sourceSpaceElt );  context.moveTo( p[0], p[1] );
//						p = this.viewUtils.localToGlobal( [x0, y0, z1], this._sourceSpaceElt );  context.lineTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y0, z0], ssMat );  context.moveTo( p[0], p[1] );
						p = this.viewUtils.localToGlobal2( [x0, y0, z1], ssMat );  context.lineTo( p[0], p[1] );
						context.closePath();  context.stroke();
					}
				}
			}
		}
	},


	drawElementNormal:
	{
		value: function( elt )
		{
			if (!this.isDrawingElementNormal()) return;

			// set the element to be the viewport object - temporarily
			this.viewUtils.pushViewportObj( elt );

			// save the source space object and set to the target object
			var saveSource = this._sourceSpaceElt;
			this._sourceSpaceElt = elt;

			// temporarily set the line color
			var saveColor = this._lineColor;
			this._lineColor = "blue";

			var base = this.viewUtils.getCenterOfProjection();
			base[2] = 1;   // Z - make it just off the plane to avoid numerical issues
			var zAxis = base.slice(0);
			zAxis[2] += 50;
			this.moveTo( base );
			this.lineTo( zAxis );

			// draw the arrowhead
			var headWidth = 6;
			var head = MathUtils.interpolateLine3D( base, zAxis, 0.7 );
			var p0 = head.slice(0);  p0[1] += headWidth;  this.drawLine( zAxis, p0 );
			var p1 = head.slice(0);  p1[0] += headWidth;  this.drawLine( zAxis, p1 );
			var p2 = head.slice(0);  p2[1] -= headWidth;  this.drawLine( zAxis, p2 );
			var p3 = head.slice(0);  p3[0] -= headWidth;  this.drawLine( zAxis, p3 );

			this.moveTo( p0 );
			this.lineTo( p1 );
			this.lineTo( p2 );
			this.lineTo( p3 );
			this.lineTo( p0 );

			// restore the state
			this.viewUtils.popViewportObj();
			this._lineColor = saveColor;
			this._sourceSpaceElt = saveSource;
		}
	},

	draw3DCompass : {
		value: function() {
			// set the element to be the viewport object - temporarily
			var tmpCanvas = this.application.ninja.stage.canvas;
			var tmpStage = this.application.ninja.currentDocument.documentRoot;
			this.viewUtils.pushViewportObj( tmpCanvas );
			var tmpStage = this.application.ninja.currentDocument.documentRoot;

			// save the source space object and set to the target object
			var saveSource = this._sourceSpaceElt;
			this._sourceSpaceElt = tmpStage;

			// temporarily set the line color
			var saveColor = this._lineColor;
			var saveLineWidth = this._lineWidth;

			var origLeft = 50;
			var origTop = 50;

			var mat = this.viewUtils.getMatrixFromElement( this._sourceSpaceElt );
			var tMat = Matrix.Translation([origLeft,origTop,0]);

			mat[12] = 0;
			mat[13] = 0;
			mat[14] = 0;

			//var resMat = tMat.multiply(mat);
			var resMat = glmat4.multiply( tMat, mat, [] );
			var origin = [0,0,0,1];

			var zoomFactor = this.application.ninja.documentBar.zoomFactor/100.0;
			var arrowSize = 50 / zoomFactor;
			var xAxis = [arrowSize,0,0,1];
			//var rO = resMat.multiply(origin);
			var rO = glmat4.multiplyVec3( resMat, origin, []);  
			//var xO = resMat.multiply(xAxis);
			var xO = glmat4.multiplyVec3( resMat, xAxis, []);

			var yAxis = [0,arrowSize,0,1];
			var yO = glmat4.multiplyVec3( resMat, yAxis, []);

			var zAxis = [0,0,arrowSize,1];
			var zO = glmat4.multiplyVec3( resMat, zAxis, []);

			var saveContext = this.getDrawingSurfaceElement();
			//this.setDrawingSurfaceElement(window.stageManager.layoutCanvas);
			this.setDrawingSurfaceElement(this.application.ninja.stage.layoutCanvas);
			// clear just the 3d compass area
			this._drawingContext.save();
			this._drawingContext.rect(0, 0, 100, 100);
			this._drawingContext.clip();

			this._drawingContext.lineWidth = 2.0;

			this._drawingContext.beginPath();
			this._drawingContext.strokeStyle = "red";
			this._drawingContext.moveTo(rO[0], rO[1]);
			this._drawingContext.lineTo(xO[0], xO[1]);
			this._drawingContext.closePath();
			this._drawingContext.stroke();
			this.drawArrowHead(rO, xO);

			this._drawingContext.beginPath();
			this._drawingContext.strokeStyle = "green";
			this._drawingContext.moveTo(rO[0], rO[1]);
			this._drawingContext.lineTo(yO[0], yO[1]);
			this._drawingContext.closePath();
			this._drawingContext.stroke();
			this.drawArrowHead(rO, yO);

			this._drawingContext.beginPath();
			this._drawingContext.strokeStyle = "blue";
			this._drawingContext.moveTo(rO[0], rO[1]);
			this._drawingContext.lineTo(zO[0], zO[1]);
			this._drawingContext.closePath();
			this._drawingContext.stroke();
			this.drawArrowHead(rO, zO);

			// restore the state
			this.viewUtils.popViewportObj();
			this._drawingContext.restore();
			this.setDrawingSurfaceElement(saveContext);
			this._lineColor = saveColor;
			this._lineWidth = saveLineWidth;
			this._sourceSpaceElt = saveSource;
		}
	},

	drawArrowHead : {
		value: function(base, onAxis) {
			var headWidth = 6;

			// draw the arrowhead
			var head = MathUtils.interpolateLine3D( base, onAxis, 0.7 );
			p0 = head.slice(0);  p0[1] += headWidth;
			p1 = head.slice(0);  p1[0] += headWidth;
			p2 = head.slice(0);  p2[1] -= headWidth;
			p3 = head.slice(0);  p3[0] -= headWidth;

			this._drawingContext.beginPath();

			this._drawingContext.moveTo(base[0], base[1]);
			this._drawingContext.lineTo(onAxis[0], onAxis[1]);

			this._drawingContext.moveTo(onAxis[0], onAxis[1]);
			this._drawingContext.lineTo(p0[0], p0[1]);
			this._drawingContext.moveTo(onAxis[0], onAxis[1]);
			this._drawingContext.lineTo(p1[0], p1[1]);
			this._drawingContext.moveTo(onAxis[0], onAxis[1]);
			this._drawingContext.lineTo(p2[0], p2[1]);
			this._drawingContext.moveTo(onAxis[0], onAxis[1]);
			this._drawingContext.lineTo(p3[0], p3[1]);

			this._drawingContext.moveTo( p0[0], p0[1] );
			this._drawingContext.lineTo( p1[0], p1[1] );
			this._drawingContext.lineTo( p2[0], p2[1] );
			this._drawingContext.lineTo( p3[0], p3[1] );
			this._drawingContext.lineTo( p0[0], p0[1] );

			this._drawingContext.closePath();

			this._drawingContext.stroke();
		}
	},

	drawGridAxes : {
		value: function (ctr, width, height, headSize) {
			this._drawingContext.lineWidth = 2.0;

			this._lineColor = "red";
			var pt0 = ctr.slice(0), pt1 = pt0.slice(0);
			pt1[0] += width;
			this.moveTo(pt0);
			this.lineTo(pt1);
			var pt2 = pt1.slice(0);
			pt2[0] -= headSize;
			pt2[1] += headSize;
			this.lineTo(pt2);
			//this.moveTo(pt1);
			pt2[1] -= 2 * headSize;
			this.lineTo(pt2);
			this.lineTo(pt1);

			this._lineColor = "green";
			pt1 = pt0.slice(0);
			pt1[1] += height;
			this.moveTo(pt0);
			this.lineTo(pt1);
			pt2 = pt1.slice(0);
			pt2[1] -= headSize;
			pt2[0] += headSize;
			this.lineTo(pt2);
			//this.moveTo(pt1);
			pt2[0] -= 2 * headSize;
			this.lineTo(pt2);
			this.lineTo(pt1);

			this._lineColor = "blue";
			pt1 = pt0.slice(0);
			pt1[2] += height < width ? height : width;
			this.moveTo(pt0);
			this.lineTo(pt1);
			pt2 = pt1.slice(0);
			pt2[2] -= headSize;
			pt2[1] += headSize;
			this.lineTo(pt2);
			//this.moveTo(pt1);
			pt2[1] -= 2 * headSize;
			this.lineTo(pt2);
			this.lineTo(pt1);
		}
	}
});