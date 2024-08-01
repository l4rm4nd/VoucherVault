var video = document.createElement("video");
var canvasElement = document.getElementById("canvas");
var canvas = canvasElement.getContext("2d");
var loadingMessage = document.getElementById("loadingMessage");
var outputContainer = document.getElementById("output");
var outputMessage = document.getElementById("outputMessage");
var outputData = document.getElementById("outputData");
var redeemCodeField = document.getElementById("redeem_code");
var qrScannerSection = document.getElementById("qrScannerSection");
var cameraIcon = document.getElementById("cameraIcon");
var camera_stream_enabled = 0;

function drawLine(begin, end, color) {
  canvas.beginPath();
  canvas.moveTo(begin.x, begin.y);
  canvas.lineTo(end.x, end.y);
  canvas.lineWidth = 4;
  canvas.strokeStyle = color;
  canvas.stroke();
}

function tick() {
  loadingMessage.innerText = "⌛ Loading video..."
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    loadingMessage.hidden = true;
    canvasElement.hidden = true;
    outputContainer.hidden = true;

    canvasElement.height = video.videoHeight;
    canvasElement.width = video.videoWidth;
    canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
    var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
    var code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code) {
      drawLine(code.location.topLeftCorner, code.location.topRightCorner, "#FF3B58");
      drawLine(code.location.topRightCorner, code.location.bottomRightCorner, "#FF3B58");
      drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, "#FF3B58");
      drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, "#FF3B58");
      outputMessage.hidden = true;
      outputData.parentElement.hidden = false;
      outputData.innerText = code.data;
      redeemCodeField.value = code.data;  // Set the redeem code field with scanned data

      // Stop the camera stream
      qrScannerSection.style.display = "none";
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
      video.pause();
      camera_stream_enabled = 0;
      cameraIcon.classList.remove("breathe-red");
    } else {
      outputMessage.hidden = false;
      outputData.parentElement.hidden = true;
    }
  }
  if (camera_stream_enabled == 1) {
    requestAnimationFrame(tick);
  }
}

document.getElementById("startScanner").addEventListener("click", function() {
  if (camera_stream_enabled == 0) {
    qrScannerSection.style.display = "block";
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
      video.srcObject = stream;
      video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
      video.play();
      camera_stream_enabled = 1;
      cameraIcon.classList.add("breathe-red");
      requestAnimationFrame(tick);
    }).catch(function(error) {
      loadingMessage.innerText = "🎥 Unable to access video stream: " + error.message;
    });
  } else {
    qrScannerSection.style.display = "none";
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    video.pause();
    camera_stream_enabled = 0;
    cameraIcon.classList.remove("breathe-red");
  }
});