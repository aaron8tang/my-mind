MM.Layout = {
	SPACING_RANK: 16,
	SPACING_CHILD: 4,
	UNDERLINE: 0.85,
	LINE_COLOR: "#aaa",
	childDirection: ""
};

/**
 * Re-draw an item and its children
 */
MM.Layout.update = function(item) {
	return this;
}

MM.Layout.pick = function(item, dir) {
	var opposite = {
		left: "right",
		right: "left",
		top: "bottom",
		bottom: "top"
	}
	var parent = item.getParent();

	if (dir == this.childDirection && item.getChildren().length) {
		return item.getChildren()[0];
	} else if (parent) {
		var parentDir = parent.getLayout().childDirection;
		if (dir == parentDir) {
			return item;
		} else if (dir == opposite[parentDir]) {
			return parent;
		} else {
			return this._pickSibling(item, (dir == "left" || dir == "top" ? -1 : +1));
		}
	} else {
		return item;
	}
}

MM.Layout._pickSibling = function(item, dir) {
	var parent = item.getParent();
	if (!parent) { return item; }

	var children = parent.getChildren();
	var index = children.indexOf(item);
	index += dir;
	index = (index+children.length) % children.length;
	return children[index];
}

/**
 * Generic child layout routine. Updates item's orthogonal size according to the sum of its children.
 */
MM.Layout._layoutItem = function(item, rankDirection) {
	var sizeProps = ["width", "height"];
	var posProps = ["left", "top"];
	var rankIndex = (rankDirection == "left" || rankDirection == "right" ? 0 : 1);
	var childIndex = (rankIndex+1) % 2;

	var rankPosProp = posProps[rankIndex];
	var childPosProp = posProps[childIndex];
	var rankSizeProp = sizeProps[rankIndex];
	var childSizeProp = sizeProps[childIndex];

	var dom = item.getDOM();
	dom.node.style.position = "absolute";
	dom.node.style.margin = dom.children.style.margin = 0;
	dom.node.style.padding = dom.children.style.padding = 0;
	dom.node.style.listStyle = "none";
	dom.content.style.position = "relative";

	var contentSize = [dom.content.offsetWidth, dom.content.offsetHeight];
	var offset = [0, 0];
	if (rankDirection == "right") { offset[0] = contentSize[0] + MM.Layout.SPACING_RANK; }
	if (rankDirection == "bottom") { offset[1] = contentSize[1] + MM.Layout.SPACING_RANK; }
	var bbox = this._layoutChildren(item.getChildren(), rankDirection, rankIndex, childIndex, offset);

	/* node size */
	var rankSize = contentSize[rankIndex];
	if (bbox[rankIndex]) { rankSize += bbox[rankIndex] + MM.Layout.SPACING_RANK; }
	var childSize = Math.max(bbox[childIndex], contentSize[childIndex]);
	dom.node.style[rankSizeProp] = rankSize + "px";
	dom.node.style[childSizeProp] = childSize + "px";

	/* label position */
	var labelPos = 0;
	if (rankDirection == "left") { labelPos = rankSize - contentSize[0]; }
	if (rankDirection == "top") { labelPos = rankSize - contentSize[1]; }
	dom.content.style[childPosProp] = Math.round((childSize - contentSize[childIndex])/2) + "px";
	dom.content.style[rankPosProp] = labelPos + "px";

	return this;
}

MM.Layout._computeChildrenBBox = function(children, rankIndex, childIndex) {
	var bbox = [0, 0];

	children.forEach(function(child, index) {
		var node = child.getDOM().node;
		var childSize = [node.offsetWidth, node.offsetHeight];

		bbox[rankIndex] = Math.max(bbox[rankIndex], childSize[rankIndex]); /* adjust cardinal size */
		bbox[childIndex] += childSize[childIndex]; /* adjust orthogonal size */
	}, this);

	if (children.length > 1) { bbox[childIndex] += MM.Layout.SPACING_CHILD * (children.length-1); } /* child separation */

	return bbox;
}

MM.Layout._layoutChildren = function(children, rankDirection, rankIndex, childIndex, offset) {
	var posProps = ["left", "top"];
	var rankPosProp = posProps[rankIndex];
	var childPosProp = posProps[childIndex];

	var bbox = this._computeChildrenBBox(children, rankIndex, childIndex);

	children.forEach(function(child, index) {
		var node = child.getDOM().node;
		var childSize = [node.offsetWidth, node.offsetHeight];

		if (rankDirection == "left") { offset[0] = bbox[0] - childSize[0]; }
		if (rankDirection == "top") { offset[1] = bbox[1] - childSize[1]; }

		node.style[childPosProp] = offset[childIndex] + "px";
		node.style[rankPosProp] = offset[rankIndex] + "px";

		offset[childIndex] += childSize[childIndex] + MM.Layout.SPACING_CHILD; /* offset for next child */
	}, this);

	return bbox;
}

MM.Layout._drawLinesHorizontal = function(item, side) {
	this._anchorCanvas(item);
	this._underline(item);
	this._drawHorizontalConnectors(item, side, item.getChildren());
}

MM.Layout._drawLinesVertical = function(item, side) {
	this._anchorCanvas(item);
	this._underline(item);
	this._drawVerticalConnectors(item, side, item.getChildren());
}

MM.Layout._drawHorizontalConnectors = function(item, side, children) {
	if (children.length == 0) { return; }

	var dom = item.getDOM();
	var canvas = dom.canvas;
	var ctx = canvas.getContext("2d");
	ctx.strokeStyle = MM.Layout.LINE_COLOR;

	/* first part */
	var R = MM.Layout.SPACING_RANK/2;
	var width = (children.length == 1 ? 2*R : R);
	
	var y = this._getUnderline(dom.content);

	if (side == "left") {
		var x1 = canvas.width - dom.content.offsetWidth;
		var x2 = x1 - width;
	} else {
		var x1 = dom.content.offsetWidth;
		var x2 = x1 + width;
	}

	ctx.beginPath();
	ctx.moveTo(x1, y);
	ctx.lineTo(x2, y);
	ctx.stroke();

	if (children.length == 1) { return; }

	/* rounded connectors */
	var c1 = children[0].getDOM();
	var c2 = children[children.length-1].getDOM();
	var offset = dom.content.offsetWidth + width;
	var x = Math.round(side == "left" ? canvas.width - offset : offset) + 0.5;

	var y1 = this._getUnderline(c1.content) + c1.node.offsetTop;
	var y2 = this._getUnderline(c2.content) + c2.node.offsetTop;
	var x1 = this._getChildAnchor(c1, side);
	var x2 = this._getChildAnchor(c2, side);

	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.arcTo(x, y1, x, y1+R, R);
	ctx.lineTo(x, y2-R);
	ctx.arcTo(x, y2, x2, y2, R);

	for (var i=1; i<children.length-1; i++) {
		var c = children[i].getDOM();
		var y = this._getUnderline(c.content) + c.node.offsetTop;
		ctx.moveTo(x, y);
		ctx.lineTo(this._getChildAnchor(c, side), y);
	}
	ctx.stroke();
}

MM.Layout._drawVerticalConnectors = function(item, side, children) {
	if (children.length == 0) { return; }

	var dom = item.getDOM();
	var canvas = dom.canvas;
	var ctx = canvas.getContext("2d");
	ctx.strokeStyle = MM.Layout.LINE_COLOR;

	/* first part */
	var R = MM.Layout.SPACING_RANK/2;
	
	var x = this._getCenterline(dom.content);
	var height = (children.length == 1 ? 2*R : R);

	if (side == "top") {
		var y1 = canvas.height - dom.content.offsetHeight;
		var y2 = y1 - height;
	} else {
		var y1 = this._getUnderline(dom.content);
		var y2 = dom.content.offsetHeight + height;
	}

	ctx.beginPath();
	ctx.moveTo(x, y1);
	ctx.lineTo(x, y2);
	ctx.stroke();

	if (children.length == 1) { return; }

	/* rounded connectors */
	var c1 = children[0].getDOM();
	var c2 = children[children.length-1].getDOM();
	var offset = dom.content.offsetHeight + height;
	var y = Math.round(side == "top" ? canvas.height - offset : offset) + 0.5;

	var x1 = this._getCenterline(c1.content) + c1.node.offsetLeft;
	var x2 = this._getCenterline(c2.content) + c2.node.offsetLeft;
	var y1 = this._getChildAnchor(c1, side);
	var y2 = this._getChildAnchor(c2, side);

	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.arcTo(x1, y, x1+R, y, R);
	ctx.lineTo(x2-R, y);
	ctx.arcTo(x2, y, x2, y2, R);

	for (var i=1; i<children.length-1; i++) {
		var c = children[i].getDOM();
		var x = this._getCenterline(c.content) + c.node.offsetLeft;
		ctx.moveTo(x, y);
		ctx.lineTo(x, this._getChildAnchor(c, side));
	}
	ctx.stroke();

}

/**
 * Adjust canvas size and position
 */
MM.Layout._anchorCanvas = function(item) {
	var dom = item.getDOM();
	var canvas = dom.canvas;
	canvas.style.position = "absolute";
	canvas.style.left = canvas.style.top = 0;
	canvas.width = dom.node.offsetWidth;
	canvas.height = dom.node.offsetHeight;
}

MM.Layout._underline = function(item) {
	var dom = item.getDOM();

	var ctx = dom.canvas.getContext("2d");
	ctx.strokeStyle = MM.Layout.LINE_COLOR;

	var left = dom.content.offsetLeft;
	var right = left + dom.content.offsetWidth;

	var top = this._getUnderline(dom.content);

	ctx.beginPath();
	ctx.moveTo(left, top);
	ctx.lineTo(right, top);
	ctx.stroke();
}

MM.Layout._getUnderline = function(node) {
	return Math.round(MM.Layout.UNDERLINE * node.offsetHeight + node.offsetTop) + 0.5;
}

MM.Layout._getCenterline = function(node) {
	return Math.round(node.offsetLeft + node.offsetWidth/2) + 0.5;
}

MM.Layout._getChildAnchor = function(dom, side) {
	if (side == "left" || side == "right") {
		var pos = dom.node.offsetLeft + dom.content.offsetLeft;
		if (side == "left") { pos += dom.content.offsetWidth; }
	} else {
		var pos = dom.node.offsetTop + dom.content.offsetTop;
		if (side == "top") { pos += dom.content.offsetHeight; }
	}
	return pos;
}