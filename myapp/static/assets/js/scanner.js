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
    "AZTEC": "azteccode",
    "CODABAR": "code39", // Codabar is not specifically listed in your options; mapped to closest available
    "CODE_39": "code39",
    "CODE_93": "code39", // Code 93 is not specifically listed; mapped to closest available
    "CODE_128": "code128",
    "DATA_MATRIX": "datamatrix",
    "EAN_8": "ean8",
    "EAN_13": "ean13",
    "ITF": "interleaved2of5",
    "MAXICODE": "datamatrix", // MaxiCode is not specifically listed; mapped to closest available
    "PDF_417": "pdf417",
    "QR_CODE": "qrcode",
    "RSS_14": "ean13", // RSS-14 closely related to EAN/UPC
    "RSS_EXPANDED": "ean13", // RSS Expanded closely related to EAN/UPC
    "UPC_A": "upca",
    "UPC_E": "upce",
    "UPC_EAN_EXTENSION": "ean13" // Extension of EAN
};

function requestAccessAndEnumerateDevices() {
    // First, request access to the camera
    navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
            // Access is granted. Now we can enumerate devices with full labels.
            stream.getTracks().forEach(track => track.stop()); // Stop the stream to not use the camera yet

            navigator.mediaDevices.enumerateDevices()
                .then((devices) => {
                    populateVideoSources(devices.filter(device => device.kind === 'videoinput'));
                })
                .catch((error) => {
                    console.error('Error listing devices after granting access:', error);
                    outputMessage.textContent = "Error listing devices: " + error.message;
                    outputMessage.style.display = 'block';
                });
        })
        .catch((error) => {
            console.error("Access denied by user or error occurred:", error);
            outputMessage.textContent = "Access denied or error occurred: " + error.message;
            outputMessage.style.display = 'block';
        });
}

// Function to populate the video sources dropdown
function populateVideoSources(videoInputDevices) {
    // Clear existing options first
    sourceSelect.innerHTML = '';
    
    videoInputDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${index + 1}`;
        sourceSelect.appendChild(option);
    });

    // Automatically start scanning using the first camera, if available
    if (videoInputDevices.length > 0) {
        sourceSelect.value = videoInputDevices[0].deviceId;
        cameraIcon.classList.add("breathe-red");
        startScanning();
    }
}

// Event listener for camera selection change
sourceSelect.addEventListener('change', () => {
    if (videoStream) {
        cameraIcon.classList.remove("breathe-red");
        stopStream(); // Stop the current video stream
    }
    cameraIcon.classList.add("breathe-red");
    startScanning();
});

function startScanning() {
    let deviceId = sourceSelect.value;  // Ensure this refers to the currently selected video source
    codeReader.decodeFromVideoDevice(deviceId, 'video', (result, err) => {
        if (result) {
            redeemCodeField.value = result.text;
            // Corrected the way to access the barcode format
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
    // Check if the protocol is HTTPS or the hostname is localhost or 127.0.0.1
    if (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        if (qrScannerSection.style.display === "none") {
            qrScannerSection.style.display = "block";
            window.scrollTo({ top: 0, behavior: 'smooth' });
            requestAccessAndEnumerateDevices();  // Request access and populate sources once granted
        } else {
            stopStream();
        }
    } else {
        // Alert the user if the protocol is not HTTPS or the hostname is not localhost/127.0.0.1
        alert("QR/EAN13 code scanning requires a secure context (HTTPS) or localhost.");
    }
});

