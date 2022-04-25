import { useQuery } from "react-query";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const toBoolean = (val) => val === "true" || val === "True";

const s3Client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL,
  forcePathStyle: toBoolean(process.env.AWS_PATH_STYLE_TRAVERSAL),
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const excludeRegex = new RegExp(process.env.EXCLUDE_PATTERN);

const listContents = async (prefix) => {
  console.debug("Retrieving data from AWS SDK");
  const data = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: process.env.BUCKET_NAME,
      Prefix: prefix,
      Delimiter: "/",
    })
  );
  console.debug(`Received data: ${JSON.stringify(data, null, 2)}`);

  return {
    folders:
      data.CommonPrefixes?.filter(
        ({ Prefix }) => !excludeRegex.test(Prefix)
      ).map(({ Prefix }) => ({
        name: Prefix.slice(prefix.length),
        path: Prefix,
        url: `/?prefix=${Prefix}`,
      })) || [],
    objects: data.Contents
      ? // eslint-disable-next-line no-undef
        await Promise.all(
          data.Contents?.filter(({ Key }) => !excludeRegex.test(Key)).map(
            async ({ Key, LastModified, Size }) => ({
              name: Key.slice(prefix.length),
              lastModified: LastModified,
              size: Size,
              path: Key,
              url: await getSignedUrl(
                s3Client,
                new GetObjectCommand({
                  Bucket: process.env.BUCKET_NAME,
                  Key: Key,
                }),
                { expiresIn: 3600 }
              ),
            })
          )
        )
      : [],
  };
};

export const useContents = (prefix) => {
  return useQuery(["contents", prefix], () => listContents(prefix));
};
