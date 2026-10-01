/** An uploaded image: the public URL to display and the provider id needed to delete it. */
export interface ImageRef {
  readonly url: string;
  readonly publicId: string;
}
