"""Storage boundary: LocalStorage today, an S3 adapter can implement this protocol later."""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import BinaryIO, Protocol


class MediaStorage(Protocol):
    def save(self, source: BinaryIO, key: str) -> Path: ...
    def open(self, key: str) -> BinaryIO: ...
    def delete(self, key: str) -> None: ...


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Keys are server-generated UUIDs, but keep the storage layer safe by design.
        path = (self.root / Path(key).name).resolve()
        if self.root.resolve() not in path.parents:
            raise ValueError("Invalid media key")
        return path

    def save(self, source: BinaryIO, key: str) -> Path:
        path = self._path(key)
        with path.open("wb") as destination:
            shutil.copyfileobj(source, destination)
        return path

    def open(self, key: str) -> BinaryIO:
        return self._path(key).open("rb")

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


def configured_storage(root: Path) -> MediaStorage:
    # The interface is intentionally provider-neutral. Set MEDIA_STORAGE=s3 only
    # after adding an S3 implementation and credentials.
    if os.getenv("MEDIA_STORAGE", "local") != "local":
        raise RuntimeError("Only MEDIA_STORAGE=local is configured in this build")
    return LocalStorage(root)
