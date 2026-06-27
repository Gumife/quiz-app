/**
 * 图片压缩工具
 * 用于压缩上传的大图，防止 localStorage 溢出
 */

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;
const QUALITY = 0.8;
const MAX_SIZE_KB = 200;

type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
};

function compressFromImage(img: HTMLImageElement, opts: Required<CompressOptions>): Promise<string> {
  return new Promise((resolve, reject) => {
    let { width, height } = img;

    if (width > opts.maxWidth || height > opts.maxHeight) {
      const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('无法创建 canvas'));
      return;
    }

    ctx.drawImage(img, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('压缩失败'));
          return;
        }

        const sizeKB = blob.size / 1024;
        if (sizeKB > opts.maxSizeKB) {
          const newQuality = Math.max(0.1, opts.quality * 0.7);
          canvas.toBlob(
            (blob2) => {
              if (!blob2) {
                reject(new Error('压缩失败'));
                return;
              }
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('读取压缩结果失败'));
              reader.readAsDataURL(blob2);
            },
            'image/jpeg',
            newQuality
          );
        } else {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('读取压缩结果失败'));
          reader.readAsDataURL(blob);
        }
      },
      'image/jpeg',
      opts.quality
    );
  });
}

function resolveOptions(options?: CompressOptions): Required<CompressOptions> {
  return {
    maxWidth: options?.maxWidth ?? MAX_WIDTH,
    maxHeight: options?.maxHeight ?? MAX_HEIGHT,
    quality: options?.quality ?? QUALITY,
    maxSizeKB: options?.maxSizeKB ?? MAX_SIZE_KB,
  };
}

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns 压缩后的 Base64 数据 URL
 */
export async function compressImage(
  file: File,
  options?: CompressOptions
): Promise<string> {
  const opts = resolveOptions(options);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(compressFromImage(img, opts));
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 检查图片是否需要压缩
 */
export function needsCompression(file: File, maxSizeKB: number = MAX_SIZE_KB): boolean {
  return file.size / 1024 > maxSizeKB;
}

/**
 * 批量压缩图片
 */
export async function compressImages(
  files: File[],
  options?: CompressOptions
): Promise<{ file: File; compressed: string }[]> {
  const results: { file: File; compressed: string }[] = [];

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      try {
        const compressed = await compressImage(file, options);
        results.push({ file, compressed });
      } catch (error) {
        console.error(`压缩图片 ${file.name} 失败:`, error);
        // 压缩失败时使用原始文件
        results.push({ file, compressed: '' });
      }
    }
  }

  return results;
}

/**
 * 压缩 Base64 图片
 * 用于压缩从文档中提取的图片
 */
export async function compressBase64Image(
  base64: string,
  options?: CompressOptions
): Promise<string> {
  const opts = resolveOptions(options);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(compressFromImage(img, opts));
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = base64;
  });
}
