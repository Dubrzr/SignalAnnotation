function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class Annotator {
  constructor(
        parent_el,
        width, height,
        sig_name, sig_vals, frequency, start_offset_ms,
        background_color, signal_color,
        magnetism,
        range,
        major_grid_x_step,
        minor_grid_x_step,
        major_grid_y_step,
        minor_grid_y_step) {
    this.w = width;
    this.h = height;

    this.viewport = new Concrete.Viewport({
        container: parent_el,
        width: this.w,
        height: this.h
    });

    this.backgroundLayer = new Concrete.Layer();
    this.gridLayer = new Concrete.Layer();
    this.signalLayer = new Concrete.Layer();
    this.annotationsLayer = new Concrete.Layer();
    this.hoverSelectionLayer = new Concrete.Layer();
    this.hudLayer = new Concrete.Layer();

    this.viewport
        .add(this.backgroundLayer)
        .add(this.gridLayer)
        .add(this.signalLayer)
        .add(this.annotationsLayer)
        .add(this.hoverSelectionLayer)
        .add(this.hudLayer);

    this.backgroundLayer.scene.context.fillStyle = background_color;
    this.backgroundLayer.scene.context.fillRect(0, 0, this.w, this.h);
    // this.annotationsLayer.scene.context.fillStyle = "rgba(255, 0, 255, 0.4)";
    // this.annotationsLayer.scene.context.fillRect(0, 0, this.w/2, this.h);


    // Add signal name
    this.hudLayer.scene.context.textAlign = 'left';
    this.hudLayer.scene.context.textBaseline = 'alphabetic';    
    this.hudLayer.scene.context.font = '16px arial';
    this.hudLayer.scene.context.strokeStyle = background_color;
    this.hudLayer.scene.context.lineWidth = 3;
    this.hudLayer.scene.context.strokeText(sig_name, 4, 25);
    this.hudLayer.scene.context.fillStyle = signal_color;
    this.hudLayer.scene.context.fillText(sig_name, 4, 25);

    this.viewport.render();

    this.annotations = []
    this.x1 = null;

    this.sig_name = sig_name;
    this.sig_vals = this._normalize(sig_vals, 0, this.h);
    this.sig_len = sig_vals.length;

    this.frequency = frequency;
    this.start_offset_ms = start_offset_ms;

    this.background_color = background_color;
    this.signal_color = signal_color;

    this.magnetism = false;
    this.isAnnotationsEnabled = true;

    this.annotationLeftClickCallback = null;
    this.annotationRightClickCallback = null;

    this.range = null;
    this.set_range(range);

    this.current_offset = 0;
    this.moveTo(0);

    this.mouseHovering = false;

    this._initializeListeners();
  }

  _clear() {
    this.backgroundLayer.scene.clear();
    this.signalLayer.scene.clear();
    this.annotationsLayer.scene.clear();
    this.hoverSelectionLayer.scene.clear();
  }

  _normalize(values, y_0, y_1) {
    const values_max = Math.max.apply(null, values);
    const values_min = Math.min.apply(null, values);
    const ratio = (y_1-y_0)/(values_max-values_min);
    const result = values.map(x => ((x + (-values_min)) * ratio) + y_0);
    console.assert(Math.max.apply(null, result) <= y_1 && Math.min.apply(null, result) >= y_0);
    return result;
  }

  _redrawAnnotations() {
    this.annotationsLayer.scene.clear();

    const pixelsPerPoint = this.w / this.range;
    const rightOffset = this.current_offset + this.range;
    const ctx = this.annotationsLayer.scene.context;

    if (this.x1 != null && this.current_offset <= this.x1 && this.x1 < rightOffset) {
        ctx.strokeStyle="rgba(255, 255, 255)";
        const x1 = Math.floor((this.x1 - this.current_offset) * pixelsPerPoint);
        // Start
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, this.h-1);
        ctx.stroke();
    }

    if (this.annotations.length === 0) {
        this.viewport.render();
        return;
    }

    for (let idx in this.annotations) {
        const ann = this.annotations[idx];
        if (ann.start < this.current_offset) {
            if (ann.end < this.current_offset) {
            }
            else if (ann.end < rightOffset) {
                ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
                ctx.strokeStyle="rgba(255, 0, 1)";

                const x2 = (ann.end - this.current_offset) * pixelsPerPoint;

                ctx.fillRect(0, 0, x2, this.h);

                // End
                ctx.beginPath();
                ctx.moveTo(x2, 0);
                ctx.lineTo(x2, this.h-1);
                ctx.stroke();
            }
            else {
                ctx.fillStyle = "rgba(0, 255, 0, 0.2)";

                ctx.fillRect(0, 0, this.w, this.h);
            }
        }
        else {
            if (ann.start > rightOffset) {
            }
            else if (ann.end < rightOffset) {
                ctx.fillStyle = "rgba(0, 0, 255, 0.2)";
                ctx.strokeStyle="rgba(0, 0, 255, 1)";

                const x1 = Math.floor((ann.start - this.current_offset) * pixelsPerPoint);
                const x2 = Math.floor((ann.end - this.current_offset) * pixelsPerPoint);

                ctx.fillRect(x1, 0, x2-x1, this.h);

                // Start
                ctx.beginPath();
                ctx.moveTo(x1, 0);
                ctx.lineTo(x1, this.h-1);
                ctx.stroke();
                // End
                ctx.beginPath();
                ctx.moveTo(x2, 0);
                ctx.lineTo(x2, this.h-1);
                ctx.stroke();
            }
            else {
                ctx.fillStyle = "rgba(0, 255, 255, 0.2)";
                ctx.strokeStyle="rgba(0, 255, 255, 1)";

                const x1 = Math.floor((ann.start - this.current_offset) * pixelsPerPoint);

                ctx.fillRect(x1, 0, this.w-x1, this.h);

                // Start
                ctx.beginPath();
                ctx.moveTo(x1, 0);
                ctx.lineTo(x1, this.h-1);
                ctx.stroke();
            }
        }
    this.viewport.render();
    }
  }

  moveTo(offsetPts) {
    if (offsetPts < 0 || offsetPts >= this.sig_len) {
        console.warn("Offset out of bounds while moving to " + offsetPts);
        return;
    }
    this.current_offset = offsetPts;
    this.signalLayer.scene.clear();

    const ctx = this.signalLayer.scene.context;

    ctx.strokeStyle = this.signal_color;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;

    const pxsPerPts = this.w / this.range;

    const end = Math.min(this.sig_len, offsetPts + this.range);
    //const vals = this._normalize(this.sig_vals.slice(offsetPts, end), 0, this.h);
    const vals = this.sig_vals.slice(offsetPts, end);

    ctx.beginPath();
    ctx.moveTo(0, vals[0]);
    for (let i = 0; i < vals.length; i++) {
        if (i >= this.sig_len)
            break;
        ctx.lineTo(Math.floor(pxsPerPts * i), vals[i]);
    }
    ctx.stroke();
    this.viewport.render();

    if (this.isAnnotationsEnabled)
        this._redrawAnnotations();
  }

  zoomToEvent(event) {
    let multiplier;
    if (event.deltaY < 0) {
        multiplier = 0.9;
    }
    else if (event.deltaY > 0) {
        multiplier = 1/0.9;
    }

    const boundingRect = this.viewport.scene.canvas.getBoundingClientRect();
    const x_pxs = event.clientX - boundingRect.left;

    const x_percentage = x_pxs / this.w

    const pixelsPerPoint = this.w / this.range;
    const offset_pts = Math.floor(this.current_offset + x_pxs / pixelsPerPoint);

    this.range = this.range * multiplier;

    const newOffset = Math.min(Math.max(0, offset_pts - this.range * x_percentage), this.sig_len);

    // FIXME
    this.moveTo(newOffset);

    // this.hoverSelectionLayer.scene.clear();
    // const ctx = this.hoverSelectionLayer.scene.context;
    
    // ctx.strokeStyle="rgba(255, 255, 255)";
    // const x1 = Math.floor((clickOffset - this.current_offset) * pixelsPerPoint);
    // // Start
    // ctx.beginPath();
    // ctx.moveTo(x1, 0);
    // ctx.lineTo(x1, this.h-1);
    // ctx.stroke();
    // this.viewport.render();
  }

  set_range(rangePoints) {
    if (rangePoints < 1) {
        console.warn("Range unexpected while setting new range " + rangePoints);
        return;
    }
    const end = Math.min(this.sig_len-1, rangePoints);
    // console.log(this.sig_len);
    // console.log(end);
    // console.log(this.sig_vals);
    // const result = largestTriangleThreeBuckets([this.sig_vals], 10);
    // console.log(result[0]);
    this.range = rangePoints;
  }

  set_range_multiply(multiplier) {
    this.set_range(this.range * multiplier);
  }

  get_annotations() {
    return "annotations";
  }

  enable_magnetism() {
    this.magnetism = true;
  }

  disable_magnetism() {
    this.magnetism = false;
  }

  enable_annotations() {
    this.isAnnotationsEnabled = true;
  }

  disable_annotations() {
    this.isAnnotationsEnabled = false;
  }

  remove_annotation(annotation) {
    //console.log("indexof... " + this.annotations.indexOf(annotation));
    for (let idx in this.annotations) {
        const ann = this.annotations[idx];
        if (ann.start === annotation.start && ann.end == annotation.end) {
            //console.log("removing annotation at idx = " + idx)
            this.annotations.splice(idx, 1);
            break;
        }
    }
    this._redrawAnnotations();
  }

  _redraw_hover_annotation_layer(event) {
    if (!this.isAnnotationsEnabled || !this.mouseHovering) {
        this.hoverSelectionLayer.scene.clear();
        this.viewport.render();
        return;
    }

    console.assert(this.mouseHovering);

    const boundingRect = this.viewport.scene.canvas.getBoundingClientRect();
    const x = event.clientX - boundingRect.left;

    const pixelsPerPoint = this.w / this.range;
    const clickOffset = Math.floor(this.current_offset + x / pixelsPerPoint)

    this.hoverSelectionLayer.scene.clear();
    const ctx = this.hoverSelectionLayer.scene.context;
    
    ctx.strokeStyle="rgba(255, 255, 255)";
    const x1 = Math.floor((clickOffset - this.current_offset) * pixelsPerPoint);
    // Start
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, this.h-1);
    ctx.stroke();
    this.viewport.render();
  }

  // LISTENERS
  _initializeListeners() {
    const me = this;
    this.viewport.scene.canvas.addEventListener('mouseover', function(event) {
        me.mouseHovering = true;
        me.viewport.scene.canvas.addEventListener('mousemove', me._redraw_hover_annotation_layer.bind(me));
    });

    this.viewport.scene.canvas.addEventListener('mouseout', function(event) {
        me.mouseHovering = false;
        me.viewport.scene.canvas.removeEventListener('mousemove', me._redraw_hover_annotation_layer.bind(me));

        me.hoverSelectionLayer.scene.clear();
        me.viewport.render();
    });

    this.viewport.scene.canvas.addEventListener('mouseup', function(event) {
        if (event.button !== 0 || !me.isAnnotationsEnabled)
            return;

        const boundingRect = me.viewport.scene.canvas.getBoundingClientRect();
        const x = event.clientX - boundingRect.left;
        //const y = event.clientY - boundingRect.top;

        const pixelsPerPoint = me.w / me.range;
        const clickOffset = Math.floor(me.current_offset + x / pixelsPerPoint)

        let wasClickOnAnn = false;
        for (let idx in me.annotations) {
            const ann = me.annotations[idx];
            if (ann.start <= clickOffset && clickOffset <= ann.end) {
                if (me.annotationLeftClickCallback !== null) {
                    me.annotationLeftClickCallback(event, ann);
                }
                wasClickOnAnn = true;
                break;
            }
        }
        if (wasClickOnAnn)
            return;

        if (me.x1 === null) {
            me.x1 = clickOffset;
        }
        else {
            const x2 = clickOffset;
            let ann = null;
            if (me.x1 < x2)
                ann = {'start': me.x1, 'end': x2, 'type': 'unknown'};
            else
                ann = {'start': x2, 'end': me.x1, 'type': 'unknown'};
            me.annotations.push(ann)
            me.x1 = null;
            console.log("created new ann:");
            console.log(ann)
        }

        me._redrawAnnotations();
    });

    this.viewport.scene.canvas.addEventListener('contextmenu', function(event) {
        const boundingRect = me.viewport.scene.canvas.getBoundingClientRect();
        const x = event.clientX - boundingRect.left;
        //const y = event.clientY - boundingRect.top;

        const pixelsPerPoint = me.w / me.range;
        const clickOffset = Math.floor(me.current_offset + x / pixelsPerPoint)

        for (let idx in me.annotations) {
            const ann = me.annotations[idx];
            if (ann.start <= clickOffset && clickOffset <= ann.end) {
                if (me.annotationRightClickCallback !== null) {
                    me.annotationRightClickCallback(event, ann);
                }
                break;
            }
        }
    });

    
  }

  setAnnotationLeftClickCallback(callback) {
    this.annotationLeftClickCallback = callback;
  }

  setAnnotationRightClickCallback(callback) {
    this.annotationRightClickCallback = callback;
  }

}

