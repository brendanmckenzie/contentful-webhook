# contentful-webhook

## Getting started

 1. Create a space on [Contentful](https://www.contentful.com/)
 2. Create an [S3 bucket on AWS](https://console.aws.amazon.com/)
 3. Create an IAM role with access to read/write to the buckets
 4. Create a JSON file named `config.json` with the contents below - replacing all the `...` with their respective values - to brendan@mckenzie.io
 5. Create the necessary templates and put them in the .templates folder in your S3 bucket
 6. Add a webhook in Contentful *only* for "Entries" on "publish" and "unpublish", all other events will be ignored
 7. Create a Content Type called "post" (to match the example config), and publish

### config.json contents

    {
      templates: {
        region: "us-east-1",
        accessKeyId: "...",
        secretAccessKey: "...",
        bucket: "...",
        keyPrefix: ".templates/"
      },
      target: {
        region: "us-east-1",
        accessKeyId: "...",
        secretAccessKey: "...",
        bucket: "...",
        keyPrefix: ""
      },
      contentful: {
        apiKey: "...",
        space: "..."
      },
      paths: {
        post: "/blog/{{=it.fn.moment(it.date).format('YYYY/MM')}}/{{=it.slug}}"
      }
    }

