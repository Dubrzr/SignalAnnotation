# SignalAnnotation

Open-Source, Web-based application to Annotate signal, timeseries, waveforms...

Preview here: https://sigannot.juliendubiel.net/

![Preview](preview.png)

Current state: 

* Load data:
  * [ ] Add a new signal 
    * [ ] From uploaded json file
    * [ ] From uploaded csv file
    * [x] From hardcoded json file link (for demo)
    * [ ] From hardcoded csv file link (for demo)
  * [ ] Delete a signal
  * [ ] Directly from Physionet for immediate public physiological data annotation 
* Display data:
  * [x] Zoom in/out using ctrl+mouse scrool
  * [ ] Zoom in/out using interface buttons
  * [x] Move forward/backward using keyboard arrows
  * [x] Move forward/backward using interface buttons
  * [x] Display a grid
  * [ ] Specify grid spacing  
* Annotate:
  * [x] Select a single-sample
  * [x] Select a range
  * [ ] Edit annotation types
  * [x] Delete an annotation
* [x] Help button
* [ ] Export annotations
* Future functionnality:
* [ ] Store modifications in localstorage
* [ ] Fast scroll using a small preview of all the signal like sublimetext
* [ ] Implement magnetism :
  * [ ] to easily click on specific attributes of the signal (for example peaks)
  * [ ] to simplify editing annotations that are single-sample wide
* [ ] Keyboard shortcuts for fast annotation

## Run the application

There are two usable files that you can simply open with your browser (after cloning/downloading this whole folder):

* `example.html`: as its name exaplains it, it's an example. The data displayed by example.html is loaded from `test_data.json`.
* `app.html`: this is the final app that is currently under active development, you can try the implemented features, the format of the json file must be like this:

```json
{"values": [0.45,0.88, 0.98, 1.35...]}
```


## Development

This application is developped as a library file : `annotator.js` that might be used anywhere else, example.html and app.html are example usages of this library.

It only depends on the excellent Concrete.js library  : http://www.concretejs.com/

