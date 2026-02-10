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
const cropSection = document.getElementById('cropSection');
const cropCanvas = document.getElementById('cropCanvas');
const scanCroppedBtn = document.getElementById('scanCroppedBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');
const resetSelectionBtn = document.getElementById('resetSelectionBtn');
const cropPreviewSection = document.getElementById('cropPreviewSection');
const cropPreviewCanvas = document.getElementById('cropPreviewCanvas');

let videoStream;
const codeReader = new ZXing.BrowserMultiFormatReader();
let isDecoding = false;

// Crop canvas state
let currentImage = null;
let cropStartX = 0;
let cropStartY = 0;
let cropEndX = 0;
let cropEndY = 0;
let isDrawing = false;

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

        let img = null; // Declare img outside try block so it's accessible in catch

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

            img = new Image();
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
            
            // Show crop interface for manual selection if image was loaded
            if (img && img.complete) {
                outputMessage.textContent = "Could not detect barcode. Opening crop tool...";
                outputMessage.style.display = 'block';
                
                setTimeout(() => {
                    showCropInterface(img);
                }, 1000);
            } else {
                outputMessage.textContent = "Could not load image. Please try again.";
                setTimeout(() => {
                    outputMessage.style.display = 'none';
                }, 5000);
            }
        } finally {
            isDecoding = false;
            fileInput.value = '';
        }
    });
}

// Canvas crop functionality
function showCropInterface(img) {
    if (!cropSection || !cropCanvas) return;
    
    currentImage = img;
    cropSection.style.display = 'block';
    outputMessage.style.display = 'none';
    
    // Set canvas size - maintain reasonable size for easy cropping on mobile
    // Fixed max height to prevent large images from occupying whole screen
    const minDisplayWidth = 600; // Minimum width for easy cropping
    const maxDisplayWidth = 1200; // Only scale down if larger than this
    const maxDisplayHeight = 500; // Fixed max height for canvas
    
    let displayWidth = img.width;
    if (img.width > maxDisplayWidth) {
        displayWidth = maxDisplayWidth;
    } else if (img.width < minDisplayWidth) {
        displayWidth = minDisplayWidth;
    }
    
    let scale = displayWidth / img.width;
    let displayHeight = img.height * scale;
    
    // If height exceeds max, scale down further based on height
    if (displayHeight > maxDisplayHeight) {
        scale = maxDisplayHeight / img.height;
        displayWidth = img.width * scale;
        displayHeight = maxDisplayHeight;
    }
    
    cropCanvas.width = displayWidth;
    cropCanvas.height = displayHeight;
    cropCanvas.style.maxHeight = maxDisplayHeight + 'px';
    
    // Draw image on canvas
    const ctx = cropCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, cropCanvas.width, cropCanvas.height);
    
    // Reset crop coordinates
    cropStartX = 0;
    cropStartY = 0;
    cropEndX = 0;
    cropEndY = 0;
    isDrawing = false;
    
    // Scroll to crop section
    cropSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function drawCropArea() {
    if (!currentImage || !cropCanvas) return;
    
    const ctx = cropCanvas.getContext('2d');
    const scale = cropCanvas.width / currentImage.width;
    
    // Redraw original image
    ctx.drawImage(currentImage, 0, 0, cropCanvas.width, cropCanvas.height);
    
    // Draw selection rectangle
    if (isDrawing || (cropEndX !== cropStartX && cropEndY !== cropStartY)) {
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
        
        const x = Math.min(cropStartX, cropEndX);
        const y = Math.min(cropStartY, cropEndY);
        const width = Math.abs(cropEndX - cropStartX);
        const height = Math.abs(cropEndY - cropStartY);
        
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
    }
}

// Canvas mouse events for crop selection
if (cropCanvas) {
    cropCanvas.addEventListener('mousedown', (e) => {
        const rect = cropCanvas.getBoundingClientRect();
        cropStartX = e.clientX - rect.left;
        cropStartY = e.clientY - rect.top;
        isDrawing = true;
    });
    
    cropCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = cropCanvas.getBoundingClientRect();
        cropEndX = e.clientX - rect.left;
        cropEndY = e.clientY - rect.top;
        drawCropArea();
    });
    
    cropCanvas.addEventListener('mouseup', () => {
        isDrawing = false;
        drawCropArea();
    });
    
    // Touch events for mobile
    cropCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = cropCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        cropStartX = touch.clientX - rect.left;
        cropStartY = touch.clientY - rect.top;
        isDrawing = true;
    });
    
    cropCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const rect = cropCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        cropEndX = touch.clientX - rect.left;
        cropEndY = touch.clientY - rect.top;
        drawCropArea();
    });
    
    cropCanvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        isDrawing = false;
        drawCropArea();
    });
}

// Scan cropped area button
if (scanCroppedBtn) {
    scanCroppedBtn.addEventListener('click', async () => {
        if (!currentImage || !cropCanvas) return;
        
        // Validate selection
        const width = Math.abs(cropEndX - cropStartX);
        const height = Math.abs(cropEndY - cropStartY);
        
        if (width < 20 || height < 20) {
            outputMessage.textContent = "Please select a larger area";
            outputMessage.style.display = 'block';
            setTimeout(() => {
                outputMessage.style.display = 'none';
            }, 3000);
            return;
        }
        
        scanCroppedBtn.disabled = true;
        outputMessage.textContent = "Scanning selected area...";
        outputMessage.style.display = 'block';
        
        try {
            // Calculate crop coordinates relative to original image (no padding)
            const scale = currentImage.width / cropCanvas.width;
            
            const x = Math.min(cropStartX, cropEndX) * scale;
            const y = Math.min(cropStartY, cropEndY) * scale;
            const cropWidth = width * scale;
            const cropHeight = height * scale;
            
            // Create a new canvas with cropped area
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = cropWidth;
            tempCanvas.height = cropHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw cropped portion (exact selection, no padding)
            tempCtx.drawImage(
                currentImage,
                x, y, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );
            
            // Show preview of what will be scanned
            if (cropPreviewCanvas && cropPreviewSection) {
                cropPreviewCanvas.width = cropWidth;
                cropPreviewCanvas.height = cropHeight;
                const previewCtx = cropPreviewCanvas.getContext('2d');
                previewCtx.drawImage(tempCanvas, 0, 0);
                cropPreviewSection.style.display = 'block';
            }
            
            // Convert to image for scanning
            const croppedDataUrl = tempCanvas.toDataURL('image/png');
            const croppedImg = new Image();
            await new Promise((resolve, reject) => {
                croppedImg.onload = resolve;
                croppedImg.onerror = reject;
                croppedImg.src = croppedDataUrl;
            });
            
            // Wait for image to be fully decoded
            if (croppedImg.decode) {
                await croppedImg.decode();
            }
            
            // Scan twice - ZXing needs warmup (same as main file upload scan)
            let result = null;
            let lastError = null;

            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    // Create fresh reader for each attempt
                    const scanReader = new ZXing.BrowserMultiFormatReader();
                    const hints = new Map();
                    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
                    scanReader.hints = hints;
                    
                    result = await scanReader.decodeFromImageElement(croppedImg);
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
            
            // Success!
            redeemCodeField.value = result.text;
            
            if (result.format !== undefined) {
                const formatValue = barcodeFormatMap[barcodeFormats[result.format]];
                if (formatValue) {
                    redeemTypeField.value = formatValue;
                }
            }
            
            redeemCodeField.focus();
            outputMessage.textContent = "Code successfully scanned!";
            
            // Hide crop section after success
            setTimeout(() => {
                cropSection.style.display = 'none';
                outputMessage.style.display = 'none';
                if (cropPreviewSection) cropPreviewSection.style.display = 'none';
                currentImage = null;
            }, 2000);
            
        } catch (error) {
            console.error("Cropped scan error:", error);
            outputMessage.textContent = "Could not detect barcode in selected area. Try selecting a different area.";
            
            // Don't hide preview on error - let user see what was scanned and try again
            setTimeout(() => {
                outputMessage.style.display = 'none';
            }, 5000);
        } finally {
            scanCroppedBtn.disabled = false;
        }
    });
}

// Cancel crop button
if (cancelCropBtn) {
    cancelCropBtn.addEventListener('click', () => {
        cropSection.style.display = 'none';
        outputMessage.style.display = 'none';
        if (cropPreviewSection) cropPreviewSection.style.display = 'none';
        currentImage = null;
        fileIcon?.classList.remove("breathe-red");
    });
}

// Reset selection button
if (resetSelectionBtn) {
    resetSelectionBtn.addEventListener('click', () => {
        // Reset crop coordinates
        cropStartX = 0;
        cropStartY = 0;
        cropEndX = 0;
        cropEndY = 0;
        isDrawing = false;
        
        // Hide preview
        if (cropPreviewSection) cropPreviewSection.style.display = 'none';
        
        // Redraw original image without selection
        if (currentImage && cropCanvas) {
            const ctx = cropCanvas.getContext('2d');
            ctx.drawImage(currentImage, 0, 0, cropCanvas.width, cropCanvas.height);
        }
    });
}

