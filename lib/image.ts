export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1800;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Safari 等浏览器回退到 <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("图片解析失败"));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择 JPG、PNG 或 WebP 格式的图片。");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("图片超过 15 MB，请先压缩或降低分辨率后再上传。");
  }

  const { source, width, height } = await decode(file);
  if (!width || !height) {
    throw new Error("无法读取这张图片，请换一张重试。");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法处理图片。");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  if (source instanceof ImageBitmap) source.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
  const bytes = Math.round((dataUrl.length - "data:image/jpeg;base64,".length) * 0.75);

  return { dataUrl, width: targetWidth, height: targetHeight, bytes };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
