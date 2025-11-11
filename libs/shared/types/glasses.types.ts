/**
 * Glasses Model Types
 * Types for glasses 3D models used in virtual try-on feature
 */

export interface GlassesModelResponse {
  id: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  model3dUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlassesModelDownloadResponse {
  url: string; // Presigned URL or direct download URL
}

