"""Remove local media that is unreferenced and older than the configured retention."""
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
db_path = root / os.getenv("CHETTIK_DB", "chettik.db")
media_root = root / os.getenv("MEDIA_ROOT", "backend/media")
days = int(os.getenv("MEDIA_RETENTION_DAYS", "30"))
cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

with sqlite3.connect(db_path) as db:
    stale = db.execute(
        """SELECT mo.id, mo.storage_key FROM media_objects mo
           WHERE mo.created_at<? AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.media_id=mo.id)""",
        (cutoff,),
    ).fetchall()
    for media_id, storage_key in stale:
        path = (media_root / Path(storage_key).name).resolve()
        if media_root.resolve() in path.parents:
            path.unlink(missing_ok=True)
        db.execute("DELETE FROM media_objects WHERE id=?", (media_id,))

print(f"Deleted {len(stale)} expired unreferenced local media objects.")
