let ffmpegEncoder = function(encoderArgs, files) {
  let stdout = "";
  let stderr = "";
  let worker = new Worker("./scripts/ffmpeg-worker-mp4.js");

  let globalResolve;
  let videoResolve;

  this.ready = new Promise(function(resolve, reject) {
    globalResolve = resolve;
  });

  this.videoReady = new Promise(function(resolve, reject) {
    videoResolve = resolve;
  });

  this.run = function(files) {
    let args = ['-y']
              .concat((encoderArgs || []))
              .concat([
                '-i', files[0].name,
                '-i', files[1].name,
                '-filter_complex', '[1:v]scale=480:-1[scaled_overlay],[0:v][scaled_overlay]overlay=x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2',
                'output.mp4'
              ]);
 
    const idealheap = 1024 * 1024 * 1024;
  
    worker.postMessage({
        type: "run",
        arguments: args,
        TOTAL_MEMORY: idealheap,
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
      if(this.stderr) this.stderr(msg);
      stdout += msg.data + "\n";
      break;
    case "stderr":
      if(this.stderr) this.stderr(msg);
      stderr += msg.data + "\n";
      break;
    case "done":
      videoResolve(msg.data);
      worker.terminate();
      console.log("done");
      break;
    case "exit":
      console.log("Process exited with code " + msg.data);
      console.log(stderr);
      console.log(stdout);
      break;
    }
  }.bind(this);
};