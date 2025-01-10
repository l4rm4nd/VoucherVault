const redeemCodeField = document.getElementById('redeem_code');
const redeemTypeField = document.getElementById('code_type');
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

const barcodeFormats = [
    "AZTEC",
    "CODABAR",
    "CODE_39",
    "CODE_93",
    "CODE_128",
    "DATA_MATRIX",
    "EAN_8",
    "EAN_13",
    "ITF",
    "MAXICODE",
    "PDF_417",
    "QR_CODE",
    "RSS_14",
    "RSS_EXPANDED",
    "UPC_A",
    "UPC_E",
    "UPC_EAN_EXTENSION"
];

const barcodeFormatMap = {
    "AZTEC": "datamatrix", // Assuming you want to use the same for Aztec, adjust if needed
    "CODABAR": "code39", // Codabar is not specifically listed in your options; mapped to closest available
    "CODE_39": "code39",
    "CODE_93": "code39", // Code 93 is not specifically listed; mapped to closest available
    "CODE_128": "code128",
    "DATA_MATRIX": "datamatrix",
    "EAN_8": "ean8",
    "EAN_13": "ean13",
    "ITF": "code39", // Interleaved Two of Five; mapped to closest available if specific mapping required
    "MAXICODE": "datamatrix", // MaxiCode is not specifically listed; mapped to closest available
    "PDF_417": "pdf417",
    "QR_CODE": "qrcode",
    "RSS_14": "ean13", // RSS-14 closely related to EAN/UPC
    "RSS_EXPANDED": "ean13", // RSS Expanded closely related to EAN/UPC
    "UPC_A": "upca",
    "UPC_E": "upce",
    "UPC_EAN_EXTENSION": "ean13" // Extension of EAN
};

function startScanning() {
    codeReader.decodeFromVideoDevice(null, 'video', (result, err) => {
        if (result) {
            redeemCodeField.value = result.text;
            const formatValue = barcodeFormatMap[barcodeFormats[result.format]]; // Use the new mapping
            redeemTypeField.value = formatValue;
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
