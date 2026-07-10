const cloudinary = require("../../config/cloudinary")

function getPublicIdFromUrl(url) {
  if (!url) return null

  const parts = url.split("/")
  const filename = parts[parts.length - 1]
  const folder = parts[parts.length - 2]

  const publicId = `${folder}/${filename.split(".")[0]}`

  return publicId
}

async function deleteCloudinaryImage(url) {
  const publicId = getPublicIdFromUrl(url)

  if (!publicId) return

  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (err) {
    console.error("Cloudinary delete failed:", err)
  }
}

module.exports = deleteCloudinaryImage