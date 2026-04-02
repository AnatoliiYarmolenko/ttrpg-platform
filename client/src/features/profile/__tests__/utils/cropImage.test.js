import { describe, it, expect } from 'vitest';
import { getCroppedImageFile } from '../../utils/cropImage';

describe('cropImage utilities', () => {
  it('throws error when croppedAreaPixels is null', async () => {
    const imageSrc = 'data:image/png;base64,test';

    await expect(getCroppedImageFile(imageSrc, null)).rejects.toThrow(
      'Не вибрано область обрізки'
    );
  });

  it('throws error when croppedAreaPixels is undefined', async () => {
    const imageSrc = 'data:image/png;base64,test';

    await expect(getCroppedImageFile(imageSrc, undefined)).rejects.toThrow(
      'Не вибрано область обрізки'
    );
  });
});
