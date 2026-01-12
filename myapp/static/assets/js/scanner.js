const redeemCodeField = document.getElementById('redeem_code');
const redeemTypeField = document.getElementById('code_type');
const startScannerButton = document.getElementById('startScanner');
const scanFromFileButton = document.getElementById('scanFromFile');
const fileInput = document.getElementById('fileInput');
const fileIcon = document.getElementById('fileIcon');
const qrScannerSection = document.getElementById('qrScannerSection');
const video = document.getElementById('video');
const sourceSelect = document.getElementById('sourceSelect');
const cameraIcon = document.getElementById('cameraIcon');
const loadingMessage = document.getElementById('loadingMessage');
const outputMessage = document.getElementById('outputMessage');

let videoStream;
const codeReader = new ZXing.BrowserMultiFormatReader();
let isDecoding = false;

loadingMessage.style.display = 'none';
outputMessage.style.display = 'none';

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
    "CODABAR": "code39",
    "CODE_39": "code39",
    "CODE_93": "code39",
    "CODE_128": "code128",
    "DATA_MATRIX": "datamatrix",
    "EAN_8": "ean8",
    "EAN_13": "ean13",
    "ITF": "interleaved2of5",
    "MAXICODE": "datamatrix",
    "PDF_417": "pdf417",
    "QR_CODE": "qrcode",
    "RSS_14": "ean13",
    "RSS_EXPANDED": "ean13",
    "UPC_A": "upca",
    "UPC_E": "upce",
    "UPC_EAN_EXTENSION": "ean13"
};

function getFormatNameFromResult(result) {
    try {
        if (result && typeof result.getBarcodeFormat === 'function') {
            return result.getBarcodeFormat().toString();
        }
        if (result && typeof result.format !== 'undefined') {
            return String(result.format);
        }
    } catch (e) {
        console.warn('getFormatNameFromResult failed:', e);
    }
    return 'UNKNOWN';
}

function requestAccessAndEnumerateDevices() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
            stream.getTracks().forEach(track => track.stop());

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

function populateVideoSources(videoInputDevices) {
    if (!sourceSelect) return;
    
    sourceSelect.innerHTML = '';
    
    videoInputDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${index + 1}`;
        sourceSelect.appendChild(option);
    });

    if (videoInputDevices.length > 0) {
        sourceSelect.value = videoInputDevices[0].deviceId;
        cameraIcon?.classList.add("breathe-red");
        startScanning();
    }
}

if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
        if (videoStream) {
            cameraIcon?.classList.remove("breathe-red");
            stopStream();
        }
        cameraIcon?.classList.add("breathe-red");
        startScanning();
    });
}

function startScanning() {
    if (!sourceSelect) return;
    let deviceId = sourceSelect.value;
    codeReader.decodeFromVideoDevice(deviceId, 'video', (result, err) => {
        if (result) {
            redeemCodeField.value = result.text;
            const formatValue = barcodeFormatMap[barcodeFormats[result.format]];
            if (formatValue) {
                redeemTypeField.value = formatValue;
            }
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
    if (qrScannerSection) qrScannerSection.style.display = "none";
    cameraIcon?.classList.remove("breathe-red");
}

if (startScannerButton) {
    startScannerButton.addEventListener("click", function () {
        if (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
            if (qrScannerSection.style.display === "none" || qrScannerSection.style.display === "") {
                qrScannerSection.style.display = "block";
                window.scrollTo({ top: 0, behavior: 'smooth' });
                requestAccessAndEnumerateDevices();
            } else {
                stopStream();
            }
        } else {
            alert("QR/EAN13 code scanning requires a secure context (HTTPS) or localhost.");
        }
    });
}

// File upload scanning - direct decoding with automatic retry
if (scanFromFileButton && fileInput) {
    scanFromFileButton.addEventListener("click", function () {
        fileInput.click();
    });

    fileInput.addEventListener("change", async function (event) {
        const file = event.target.files?.[0];
        if (!file) return;
        
        if (isDecoding) {
            return;
        }

        isDecoding = true;
        fileIcon?.classList.add("breathe-red");
        outputMessage.textContent = "Scanning image...";
        outputMessage.style.display = 'block';

        try {
            // Stop any camera scanning
            codeReader.reset();

            // Load image
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
            });

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });

            // Wait for image to be fully decoded
            if (img.decode) {
                await img.decode();
            }

            // Scan twice - ZXing needs warmup
            let result = null;
            let lastError = null;

            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    // Create fresh reader for each attempt
                    const scanReader = new ZXing.BrowserMultiFormatReader();
                    const hints = new Map();
                    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
                    scanReader.hints = hints;
                    
                    result = await scanReader.decodeFromImageElement(img);
                    break; // Success
                } catch (error) {
                    lastError = error;
                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }

            if (!result) {
                throw lastError || new Error("Failed to detect barcode after 2 attempts");
            }

            // Success! Set the barcode value and type
            redeemCodeField.value = result.text;

            // Map format the same way as camera scanning
            if (result.format !== undefined) {
                const formatValue = barcodeFormatMap[barcodeFormats[result.format]];
                if (formatValue) {
                    redeemTypeField.value = formatValue;
                }
            }

            redeemCodeField.focus();
            fileIcon?.classList.remove("breathe-red");
            outputMessage.textContent = "Code successfully scanned!";
            setTimeout(() => {
                outputMessage.style.display = 'none';
            }, 3000);

        } catch (error) {
            console.error("Scanning error:", error);
            fileIcon?.classList.remove("breathe-red");
            outputMessage.textContent = "Could not detect barcode. Try a clearer image with better lighting.";
            setTimeout(() => {
                outputMessage.style.display = 'none';
            }, 5000);
        } finally {
            isDecoding = false;
            fileInput.value = '';
        }
    });
}
