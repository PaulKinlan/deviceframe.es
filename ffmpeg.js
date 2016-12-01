let ffmpegEncoder = function(encoderArgs, files) {
  let stdout = "";
  let stderr = "";
  let worker = new Worker("./ffmpeg-worker-mp4.js");

  let globalResolve;
  let videoResolve;

  this.ready = new Promise(function(resolve, reject) {
    globalResolve = resolve;
  });

  this.videoReady = new Promise(function(resolve, reject) {
    videoResolve = resolve;
  });

  this.run = function(files) {
    /*
    -i $n6_frame
    -i $shot_path
    -filter_complex "[1:v]scale=480:-1[scaled_overlay],[0:v][scaled_overlay]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2"
    $shot_path-frame.mp4
   */

    let args = ['-y']
              .concat((encoderArgs || []))
              .concat([
                '-i', files[0].name,
                '-i', files[1].name,
                '-filter_complex', '[1:v]scale=480:-1[scaled_overlay],[0:v][scaled_overlay]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2',
                'output.mp4'
              ]);

    worker.postMessage({
        type: "run",
        arguments: args,
        TOTAL_MEMORY: 1024 * 1024 * 1024,
        MEMFS: files
      });
  };

  worker.onmessage = function(e) {
    var msg = e.data;
    console.log(msg.type, msg.data)
    switch (msg.type) {
    case "ready":
      globalResolve();
      break;
    case "stdout":
      stdout += msg.data + "\n";
      break;
    case "stderr":
      stderr += msg.data + "\n";
      break;
    case "exit":
      console.log("exit");
      break;
    case "done":
      videoResolve(msg.data);
      console.log("done");
      break;
    case "exit":
      console.log("Process exited with code " + msg.data);
      console.log(stderr);
      console.log(stdout);
      worker.terminate();
      break;
    }
  };
};