export interface ImageData {
  contentType: string;
  body: Buffer;
}

export interface ImageFetcher {
  fetch(url: string): Promise<ImageData>;
}
