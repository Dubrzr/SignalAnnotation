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


    //this.backgroundLayer.scene.context.fillStyle = "#000";
    //this.backgroundLayer.scene.context.fillRect(0, 0, this.w, this.h);

    this.annotationsLayer.scene.context.fillStyle = '#000';
    this.annotationsLayer.scene.context.fillRect(0, 0, this.w, this.h);


    const me = this;
    this.viewport.scene.canvas.addEventListener('mousemove', function(event) {
        console.log("mousemove hover");
        const boundingRect = me.viewport.scene.canvas.getBoundingClientRect();
        const x = event.clientX - boundingRect.left;
        const y = event.clientY - boundingRect.top;

        if (x <= 1000) {
            console.log(x)
            me.annotationsLayer.visible = true;
            me.viewport.render();
        }
        else {
            me.annotationsLayer.visible = false;
            me.viewport.render();
        }
    });


    this.sig_name = sig_name;
    this.sig_vals = sig_vals;
    this.sig_len = sig_vals.length;

    this.frequency = frequency;
    this.start_offset_ms = start_offset_ms;

    this.background_color = background_color;
    this.signal_color = signal_color;

    this.magnetism = false;
    this.range = range;
    this.set_range(range);

    this.current_offset = 0;
    this.moveTo(0);
  }

  clear() {
    //this.backgroundLayer.scene.clear();
    this.signalLayer.scene.clear();
    //this.annotationsLayer.scene.clear();
  }

  _normalize(values, y_0, y_1) {
    const values_max = Math.max.apply(null, values);
    const values_min = Math.min.apply(null, values);
    const ratio = (y_1-y_0)/(values_max-values_min);
    const result = values.map(x => ((x + (-values_min)) * ratio) + y_0);
    console.assert(Math.max.apply(null, result) <= y_1 && Math.min.apply(null, result) >= y_0);
    return result;
  }

  moveTo(offset) {
    if (offset < 0 || offset >= this.sig_len) {
        console.warn("Offset out of bounds while moving to " + offset);
        return;
    }
    this.current_offset = offset;
    this.clear();

    const ctx = this.signalLayer.scene.context;

    ctx.strokeStyle = this.signal_color;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;

    const pixelsPerPoint = this.w / this.range;

    const end = Math.min(this.sig_len, offset + this.range);
    const vals = this._normalize(this.sig_vals.slice(offset, end), 0, 100);

    ctx.beginPath();
    ctx.moveTo(0, vals[0]);
    for (let i = 0; i < vals.length; i++) {
        if (i >= this.sig_len)
            break;
        ctx.lineTo(Math.floor(pixelsPerPoint * i), vals[i]);
    }
    ctx.stroke();
    this.viewport.render();
  }

  moveToWithAnimation(offset, animation_length_ms) {
    if (offset < 0 || offset >= this.sig_len) {
        console.warn("Offset out of bounds while moving to " + offset);
        return;
    }

    const directionRight = this.current_offset < offset;

    let diff = 0;
    if (directionRight) {
        diff = offset - this.current_offset;
    } else {
        diff = this.current_offset - offset;
    }

    const movePerMS = diff / animation_length_ms;
    const moveEveryMS = 1 / movePerMS;
    let move = 0;
    let moveDelay = 0;
    if (movePerMS < 1) {
        move = 1
        moveDelay = moveEveryMS;
    } else {
        move = Math.floor(movePerMS);
        moveDelay = 1;
    }

    console.log(offset, animation_length_ms, move, moveDelay, diff);

    const startTimeMS = (new Date()).getTime();

    let k = 0;
    const startOffset = this.current_offset;
    let me = this;
    async function f() {
        while ((move * k) < diff) {
            if (((new Date()).getTime() - startTimeMS) < (k+1) * moveDelay)
                await sleep(moveDelay);
            me.moveTo(startOffset + (directionRight ? 1 : -1) * move * k);
            k += 1;
        }
    }
    f();
  }

  set_range(range) {
    if (range < 1) {
        console.warn("Range unexpected while setting new range " + range);
        return;
    }
    const end = Math.min(this.sig_len-1, range);
    // console.log(this.sig_len);
    // console.log(end);
    // console.log(this.sig_vals);
    // const result = largestTriangleThreeBuckets([this.sig_vals], 10);
    // console.log(result[0]);
    this.range = range;
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
}

