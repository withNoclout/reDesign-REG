/**
 * cropImage.js
 * Canvas-based utility to crop an image based on pixel coordinates
 * returned by react-easy-crop's onCropComplete callback.
 */

/**
 * @param {string} imageSrc  - A base64 or object URL of the source image.
 * @param {Object} pixelCrop - { x, y, width, height } in pixels.
 * @param {number} [maxSize=500] - Max width/height of the output image.
 * @returns {Promise<string>} - A base64 JPEG data URL of the cropped image.
 */
export default function getCroppedImg(imageSrc, pixelCrop, maxSize = 500) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => {
            const canvas = document.createElement('canvas');

            // Clamp output size
            let outW = pixelCrop.width;
            let outH = pixelCrop.height;
            if (outW > maxSize) {
                outH = Math.round((outH * maxSize) / outW);
                outW = maxSize;
            }
            if (outH > maxSize) {
                outW = Math.round((outW * maxSize) / outH);
                outH = maxSize;
            }

            canvas.width = outW;
            canvas.height = outH;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(
                image,
                pixelCrop.x,
                pixelCrop.y,
                pixelCrop.width,
                pixelCrop.height,
                0,
                0,
                outW,
                outH
            );

            resolve(canvas.toDataURL('image/jpeg', 0.85));
        });
        image.addEventListener('error', reject);
        image.src = imageSrc;
    });
}
