import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCroppedImageFile } from '@/features/profile/utils/cropImage';

describe('cropImage utilities', () => {
  let mockImageElement;
  let mockCanvas;
  let mockContext;
  let originalImage;
  let imageLoadCallbacks = {};

  beforeEach(() => {
    originalImage = globalThis.Image;
    imageLoadCallbacks = {};

    mockImageElement = {
      addEventListener: vi.fn((event, handler) => {
        imageLoadCallbacks[event] = handler;
      }),
      set src(value) {
        this._src = value;
        setTimeout(() => {
          if (imageLoadCallbacks.load) {
            Object.defineProperty(this, 'width', { value: 500, writable: true });
            Object.defineProperty(this, 'height', { value: 500, writable: true });
            imageLoadCallbacks.load();
          }
        }, 0);
      },
      get src() {
        return this._src;
      },
      width: 500,
      height: 500,
    };

    globalThis.Image = vi.fn(function() { return mockImageElement; });

    mockContext = {
      drawImage: vi.fn(),
    };

    mockCanvas = {
      getContext: vi.fn((type) => type === '2d' ? mockContext : null),
      toBlob: vi.fn((callback, type) => {
        const blob = new Blob(['image-data'], { type });
        callback(blob);
      }),
      width: 0,
      height: 0,
    };

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(function(tagName) {
      if (tagName === 'canvas') {
        return mockCanvas;
      }
      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Image = originalImage;
  });

  describe('getCroppedImageFile validation', () => {
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

    it('throws when the canvas context is unavailable', async () => {
      mockCanvas.getContext.mockReturnValueOnce(null);

      await expect(
        getCroppedImageFile('data:image/png;base64,test', { x: 1, y: 2, width: 10, height: 12 })
      ).rejects.toThrow('Canvas не підтримується у цьому браузері');
    });

  });

  describe('image loading', () => {
    it('successfully loads image and creates canvas with correct dimensions', async () => {
      const imageSrc = 'data:image/png;base64,test123';
      const cropArea = { x: 10, y: 20, width: 200, height: 200 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      
      await new Promise(resolve => setTimeout(resolve, 10));

      await resultPromise;

      expect(globalThis.Image).toHaveBeenCalled();
      expect(mockImageElement._src).toBe(imageSrc);
      expect(mockCanvas.width).toBe(200);
      expect(mockCanvas.height).toBe(200);
    });

    it('rejects when the source image fails to load', async () => {
      const imageSrc = 'data:image/png;base64,broken';
      const cropArea = { x: 10, y: 20, width: 200, height: 200 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      imageLoadCallbacks.error?.();

      await expect(resultPromise).rejects.toThrow('Не вдалося завантажити зображення');
      expect(mockContext.drawImage).not.toHaveBeenCalled();
      expect(mockCanvas.toBlob).not.toHaveBeenCalled();
    });

  });

  describe('canvas operations', () => {
    it('calls drawImage with correct crop parameters', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 50, y: 60, width: 300, height: 300 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      await resultPromise;

      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockImageElement,
        50, 60, 300, 300,
        0, 0, 300, 300
      );
    });

    it('rounds non-integer dimensions', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 10.7, y: 20.3, width: 150.5, height: 149.4 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      await resultPromise;

      expect(mockCanvas.width).toBe(151);
      expect(mockCanvas.height).toBe(149);
    });

    it('uses raw crop values for drawImage even when canvas is rounded', async () => {
      const imageSrc = 'data:image/png;base64:test';
      const cropArea = { x: 10.7, y: 20.3, width: 150.5, height: 149.4 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      await resultPromise;

      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockImageElement,
        10.7, 20.3, 150.5, 149.4,
        0, 0, 151, 149
      );
    });

    it('throws when canvas cannot produce a blob', async () => {
      mockCanvas.toBlob.mockImplementationOnce((callback) => callback(null));

      await expect(
        getCroppedImageFile('data:image/png;base64,test', { x: 10, y: 20, width: 200, height: 200 })
      ).rejects.toThrow('Не вдалося створити Blob із canvas');
    });

    it('ensures minimum canvas dimensions of 1x1', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 0, y: 0, width: 0.3, height: 0.2 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      await resultPromise;

      expect(mockCanvas.width).toBe(1);
      expect(mockCanvas.height).toBe(1);
    });

  });

  describe('file output', () => {
    it('returns File with webp extension', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 10, y: 20, width: 200, height: 200 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await resultPromise;

      expect(result).toBeInstanceOf(File);
      expect(result.name).toMatch(/\.webp$/);
      expect(result.type).toBe('image/webp');
    });

    it('uses provided fileName with webp extension', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 10, y: 20, width: 200, height: 200 };
      const customName = 'my-avatar.jpg';

      const resultPromise = getCroppedImageFile(imageSrc, cropArea, customName);
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await resultPromise;

      expect(result.name).toBe('my-avatar.webp');
    });

    it('normalizes uppercase extensions to webp', async () => {
      const imageSrc = 'data:image/png;base64:test';
      const cropArea = { x: 10, y: 20, width: 200, height: 200 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea, 'AVATAR.PNG');
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await resultPromise;

      expect(result.name).toBe('AVATAR.webp');
    });

    it('keeps the base name when the file has multiple dots', async () => {
      const resultPromise = getCroppedImageFile(
        'data:image/png;base64,test',
        { x: 10, y: 20, width: 200, height: 200 },
        'profile.avatar.final.jpg'
      );

      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await resultPromise;

      expect(result.name).toBe('profile.avatar.final.webp');
    });

    it('uses default "avatar" name when fileName is empty', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 10, y: 20, width: 200, height: 200 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea, '');
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await resultPromise;

      expect(result.name).toBe('avatar.webp');
    });

    it('handles fileName without extension', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 10, y: 20, width: 200, height: 200 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea, 'myphoto');
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await resultPromise;

      expect(result.name).toBe('myphoto.webp');
    });

    it('falls back to avatar when fileName contains only an extension', async () => {
      const resultPromise = getCroppedImageFile(
        'data:image/png;base64,test',
        { x: 10, y: 20, width: 200, height: 200 },
        '.jpg'
      );

      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await resultPromise;

      expect(result.name).toBe('avatar.webp');
    });

    it('sets lastModified to current time', async () => {
      const beforeTime = Date.now();
      
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 10, y: 20, width: 200, height: 200 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await resultPromise;

      const afterTime = Date.now();
      expect(result.lastModified).toBeGreaterThanOrEqual(beforeTime);
      expect(result.lastModified).toBeLessThanOrEqual(afterTime);
    });

    it('creates blob with webp type and quality 0.92', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 10, y: 20, width: 200, height: 200 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      await resultPromise;

      expect(mockCanvas.toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/webp',
        0.92
      );
    });
  });

  describe('edge cases and boundary values', () => {
    it('handles negative crop coordinates', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: -10, y: -5, width: 100, height: 100 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      await resultPromise;

      expect(mockContext.drawImage).toHaveBeenCalledWith(
        mockImageElement,
        -10, -5, 100, 100,
        0, 0, 100, 100
      );
    });

    it('handles crop area larger than image', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 0, y: 0, width: 1000, height: 1000 };

      const resultPromise = getCroppedImageFile(imageSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      await resultPromise;

      expect(mockCanvas.width).toBe(1000);
      expect(mockCanvas.height).toBe(1000);
    });

    it('handles data URL with different formats', async () => {
      const testCases = [
        { src: 'data:image/jpeg;base64,/9j/4AAQ', name: 'JPEG data URL' },
        { src: 'data:image/png;base64,iVBORw0', name: 'PNG data URL' },
        { src: 'data:image/webp;base64,UklGR', name: 'WebP data URL' },
      ];

      for (const { src } of testCases) {
        const cropArea = { x: 0, y: 0, width: 100, height: 100 };
        
        mockImageElement._src = null;
        const resultPromise = getCroppedImageFile(src, cropArea);
        await new Promise(resolve => setTimeout(resolve, 10));
        await resultPromise;
        
        expect(mockImageElement._src).toBe(src);
      }
    });

    it('handles blob URL as image source', async () => {
      const blobSrc = 'blob:http://localhost:3000/12345-67890';
      const cropArea = { x: 0, y: 0, width: 200, height: 200 };

      mockImageElement._src = null;
      const resultPromise = getCroppedImageFile(blobSrc, cropArea);
      await new Promise(resolve => setTimeout(resolve, 10));
      await resultPromise;

      expect(mockImageElement._src).toBe(blobSrc);
    });
  });

  describe('integration scenarios', () => {
    it('full workflow: load image, crop, and create file', async () => {
      const imageSrc = 'data:image/png;base64,test-workflow';
      const cropArea = { x: 25, y: 25, width: 250, height: 250 };
      const fileName = 'profile-avatar.png';

      const resultPromise = getCroppedImageFile(imageSrc, cropArea, fileName);
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = await resultPromise;

      expect(mockImageElement._src).toBe(imageSrc);
      expect(mockCanvas.width).toBe(250);
      expect(mockCanvas.height).toBe(250);
      expect(mockContext.drawImage).toHaveBeenCalled();
      expect(mockCanvas.toBlob).toHaveBeenCalled();

      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe('profile-avatar.webp');
      expect(result.type).toBe('image/webp');
    });

    it('handles special characters in fileName', async () => {
      const imageSrc = 'data:image/png;base64,test';
      const cropArea = { x: 0, y: 0, width: 100, height: 100 };
      const specialNames = [
        'фото.jpg',
        'my file name.jpg',
        'file-with-dashes.jpg',
        'file_with_underscores.jpg',
        'file.multiple.dots.jpg',
      ];

      for (const name of specialNames) {
        mockImageElement._src = null;
        const resultPromise = getCroppedImageFile(imageSrc, cropArea, name);
        await new Promise(resolve => setTimeout(resolve, 10));
        const result = await resultPromise;

        const expectedBase = name.replace(/\.[^.]+$/, '');
        expect(result.name).toBe(`${expectedBase}.webp`);
      }
    });
  });
});
