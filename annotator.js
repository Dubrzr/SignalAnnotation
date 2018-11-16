function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Downsampling Time Series for Visual Representation - Skemman
// https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf
const floor = Math.floor;
const abs = Math.abs;

function largestTriangleThreeBuckets(data, threshold) {
    var data_length = data.length;
    if (threshold >= data_length || threshold === 0) {
        return data; // Nothing to do
    }

    var sampled = [],
        sampled_index = 0;

    // Bucket size. Leave room for start and end data points
    var every = (data_length - 2) / (threshold - 2);

    var a = 0,  // Initially a is the first point in the triangle
        max_area_point,
        max_area,
        area,
        next_a;

    sampled[ sampled_index++ ] = data[ a ]; // Always add the first point

    for (var i = 0; i < threshold - 2; i++) {

        // Calculate point average for next bucket (containing c)
        var avg_x = 0,
            avg_y = 0,
            avg_range_start  = floor( ( i + 1 ) * every ) + 1,
            avg_range_end    = floor( ( i + 2 ) * every ) + 1;
        avg_range_end = avg_range_end < data_length ? avg_range_end : data_length;

        var avg_range_length = avg_range_end - avg_range_start;

        for ( ; avg_range_start<avg_range_end; avg_range_start++ ) {
          avg_x += data[ avg_range_start ][ 0 ] * 1; // * 1 enforces Number (value may be Date)
          avg_y += data[ avg_range_start ][ 1 ] * 1;
        }
        avg_x /= avg_range_length;
        avg_y /= avg_range_length;

        // Get the range for this bucket
        var range_offs = floor( (i + 0) * every ) + 1,
            range_to   = floor( (i + 1) * every ) + 1;

        // Point a
        var point_a_x = data[ a ][ 0 ] * 1, // enforce Number (value may be Date)
            point_a_y = data[ a ][ 1 ] * 1;

        max_area = area = -1;

        for ( ; range_offs < range_to; range_offs++ ) {
            // Calculate triangle area over three buckets
            area = abs( ( point_a_x - avg_x ) * ( data[ range_offs ][ 1 ] - point_a_y ) -
                        ( point_a_x - data[ range_offs ][ 0 ] ) * ( avg_y - point_a_y )
                      ) * 0.5;
            if ( area > max_area ) {
                max_area = area;
                max_area_point = data[ range_offs ];
                next_a = range_offs; // Next a is this b
            }
        }

        sampled[ sampled_index++ ] = max_area_point; // Pick this point from the bucket
        a = next_a; // This a is the next a (chosen b)
    }

    sampled[ sampled_index++ ] = data[ data_length - 1 ]; // Always add last

    return sampled;
}

class Annotator {
  constructor(parent_el, width, height, sig_name, sig_vals, frequency, start_offset_ms, background_color, signal_color, magnetism, range) {
    this.w = width;
    this.h = height;

    this.viewport = new Concrete.Viewport({
        container: parent_el,
        width: this.w,
        height: this.h
    });

    this.backgroundLayer = new Concrete.Layer();
    this.signalLayer = new Concrete.Layer();
    this.annotationsLayer = new Concrete.Layer();

    this.viewport
        .add(this.backgroundLayer)
        .add(this.signalLayer)
        .add(this.annotationsLayer);

    this.backgroundLayer.scene.context.fillStyle = "#000";
    this.backgroundLayer.scene.context.fillRect(0, 0, this.w, this.h);
    // this.annotationsLayer.scene.context.fillStyle = "rgba(255, 0, 255, 0.4)";
    // this.annotationsLayer.scene.context.fillRect(0, 0, this.w/2, this.h);
    this.viewport.render();

    this.annotations = []
    this.x1 = null;

    this.sig_name = sig_name;
    this.sig_vals = sig_vals;
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

    this._initializeListeners();
  }

  _clear() {
    this.backgroundLayer.scene.clear();
    this.signalLayer.scene.clear();
    this.annotationsLayer.scene.clear();
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
    console.log("_redrawAnnotations" + this.annotations);
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

    const end = Math.min(this.sig_len-1, offsetPts + this.range);
    const vals = this._normalize(this.sig_vals.slice(offsetPts, end), 0, this.h);

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


  // LISTENERS
  _initializeListeners() {
    const me = this;
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

    this.viewport.scene.canvas.addEventListener("wheel", function(event){
        console.log(event)
        if(event.ctrlKey){
            event.preventDefault();

            const boundingRect = me.viewport.scene.canvas.getBoundingClientRect();
            const x = event.clientX - boundingRect.left;

            if (event.deltaY < 0) {
                me.set_range(me.range * 0.9);
            }
            else if (event.deltaY > 0) {
                me.set_range(me.range / 0.9);
            }
            //me.current_offset + (me.w/me.range)*x);
            me.moveTo(me.current_offset);
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

