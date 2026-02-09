import httpx

from app.config import settings

BUCKET_NAME = "documents"
SIGNED_URL_EXPIRY = 3600  # 1 hour


async def upload_file(file_path: str, file_bytes: bytes, content_type: str) -> str:
    """Upload a file to Supabase Storage. Returns the storage path."""
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{file_path}"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            content=file_bytes,
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": content_type,
            },
        )
        response.raise_for_status()

    return file_path


async def delete_file(file_path: str) -> None:
    """Delete a file from Supabase Storage."""
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{file_path}"

    async with httpx.AsyncClient() as client:
        response = await client.delete(
            url,
            headers={"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"},
        )
        response.raise_for_status()


async def get_signed_url(file_path: str) -> str:
    """Generate a temporary signed URL for downloading a file."""
    url = f"{settings.SUPABASE_URL}/storage/v1/object/sign/{BUCKET_NAME}/{file_path}"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            },
            json={"expiresIn": SIGNED_URL_EXPIRY},
        )
        response.raise_for_status()

    data = response.json()
    # The signed URL is relative — make it absolute
    return f"{settings.SUPABASE_URL}/storage/v1{data['signedURL']}"
