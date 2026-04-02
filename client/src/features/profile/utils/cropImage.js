function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Не вдалося завантажити зображення')));
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Не вдалося створити Blob із canvas'));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export async function getCroppedImageFile(imageSrc, croppedAreaPixels, fileName = 'avatar.webp') {
  if (!croppedAreaPixels) {
    throw new Error('Не вибрано область обрізки');
  }

  const image = await createImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(croppedAreaPixels.width));
  canvas.height = Math.max(1, Math.round(croppedAreaPixels.height));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas не підтримується у цьому браузері');
  }

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await canvasToBlob(canvas, 'image/webp', 0.92);
  const normalizedName = fileName.replace(/\.[^.]+$/, '') || 'avatar';

  return new File([blob], `${normalizedName}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}
