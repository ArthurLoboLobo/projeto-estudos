#!/usr/bin/env python3
"""
Database reset script for development.

Usage:
    python reset_db.py              # Interactive confirmation
    python reset_db.py --force      # Skip confirmation
    python reset_db.py --help       # Show help

This script will:
1. Drop all tables and enums
2. Run alembic migrations to recreate everything
"""
import asyncio
import subprocess
import sys

import asyncpg


async def reset_database(force: bool = False):
    """Reset the database by dropping everything and running migrations."""
    from app.config import settings

    if not force:
        print("⚠️  WARNING: This will DELETE ALL DATA in your database!")
        print(f"   Database: {settings.DATABASE_URL.split('@')[1]}")
        response = input("\nAre you sure? Type 'yes' to continue: ")
        if response.lower() != "yes":
            print("Aborted.")
            return

    print("\n🗑️  Dropping all tables and enums...")

    # Extract connection string (remove +asyncpg driver)
    db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    conn = await asyncpg.connect(db_url)

    try:
        # Drop all tables
        await conn.execute(
            """
            DROP TABLE IF EXISTS document_chunks CASCADE;
            DROP TABLE IF EXISTS messages CASCADE;
            DROP TABLE IF EXISTS chats CASCADE;
            DROP TABLE IF EXISTS topics CASCADE;
            DROP TABLE IF EXISTS documents CASCADE;
            DROP TABLE IF EXISTS study_sessions CASCADE;
            DROP TABLE IF EXISTS profiles CASCADE;
            DROP TABLE IF EXISTS alembic_version CASCADE;
        """
        )

        # Drop all enums
        await conn.execute(
            """
            DROP TYPE IF EXISTS chunk_type CASCADE;
            DROP TYPE IF EXISTS chat_type CASCADE;
            DROP TYPE IF EXISTS processing_status CASCADE;
            DROP TYPE IF EXISTS session_status CASCADE;
        """
        )

        print("✓ All tables and enums dropped")

    finally:
        await conn.close()

    print("\n🔨 Running migrations...")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        print("✓ Migrations completed successfully")
        print("\n✅ Database reset complete!")
    else:
        print("❌ Migration failed:")
        print(result.stderr)
        sys.exit(1)


if __name__ == "__main__":
    force = "--force" in sys.argv or "-f" in sys.argv

    if "--help" in sys.argv or "-h" in sys.argv:
        print(__doc__)
        sys.exit(0)

    asyncio.run(reset_database(force=force))
