const redeemCodeField = document.getElementById('redeem_code');
const startScannerButton = document.getElementById('startScanner');
const qrScannerSection = document.getElementById('qrScannerSection');
const video = document.getElementById('video');
const cameraIcon = document.getElementById('cameraIcon');
const loadingMessage = document.getElementById('loadingMessage');
const outputMessage = document.getElementById('outputMessage');
let videoStream;
const codeReader = new ZXing.BrowserMultiFormatReader();

loadingMessage.style.display = 'none';  // Initially hide the loading message
outputMessage.style.display = 'none';  // Initially hide the output message

function startScanning() {
    codeReader.decodeFromVideoDevice(null, 'video', (result, err) => {
        if (result) {
            redeemCodeField.value = result.text;
            redeemCodeField.focus();
            stopStream();
        }
        if (err && !(err instanceof ZXing.NotFoundException)) {
            console.error(err);
            outputMessage.textContent = err;
            outputMessage.style.display = 'block';
        }
    });
}

function stopStream() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    codeReader.reset();
    qrScannerSection.style.display = "none";
    cameraIcon.classList.remove("breathe-red");
}

startScannerButton.addEventListener("click", function () {
    if (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        if (qrScannerSection.style.display === "none") {
            qrScannerSection.style.display = "block";
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to the top of the page
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
                videoStream = stream;
                video.srcObject = stream;
                video.setAttribute('playsinline', true); // required to tell iOS safari we don't want fullscreen
                video.play().then(() => {
                    startScanning();
                    cameraIcon.classList.add("breathe-red");
                }).catch(function (error) {
                    console.error('Error playing video:', error);
                    loadingMessage.style.display = 'block';  // Show the loading message if there is an error
                    loadingMessage.innerText = "🎥 Unable to play video stream: " + error.message;
                });
            }).catch(function (error) {
                loadingMessage.style.display = 'block';  // Show the loading message if there is an error
                loadingMessage.innerText = "🎥 Unable to access video stream: " + error.message;
            });
        } else {
            stopStream();
        }
    }
    else{
        alert("QR/EAN13 code scanning requires HTTPS");
    }
});
