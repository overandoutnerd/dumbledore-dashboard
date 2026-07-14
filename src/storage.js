import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "./config.js";

// Cloudflare R2 speaks the S3 API, so the AWS SDK works as-is — just point
// it at R2's per-account endpoint instead of AWS. "auto" is R2's region.
const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
    },
});

export function isR2Configured() {
    return !!(
        config.r2.accountId &&
        config.r2.accessKeyId &&
        config.r2.secretAccessKey &&
        config.r2.bucket &&
        config.r2.publicUrl
    );
}

/**
 * Uploads a buffer to R2 under `welcome-images/<key>` and returns its
 * public URL. Bucket must have public access enabled (r2.dev subdomain or
 * a custom domain mapped in the Cloudflare dashboard) — this does not sign
 * URLs, it relies on the object being publicly readable.
 */
export async function uploadImage(buffer, key, contentType) {
    const objectKey = `welcome-images/${key}`;

    await r2.send(
        new PutObjectCommand({
            Bucket: config.r2.bucket,
            Key: objectKey,
            Body: buffer,
            ContentType: contentType,
            CacheControl: "public, max-age=31536000, immutable",
        }),
    );

    return `${config.r2.publicUrl}/${objectKey}`;
}
