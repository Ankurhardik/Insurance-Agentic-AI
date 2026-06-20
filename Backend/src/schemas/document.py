from pydantic import BaseModel
from datetime import datetime

class DocumentOut(BaseModel):
    id: str
    filename: str
    content_type: str
    file_size: int
    status: str
    created_at: datetime
    created_by: str | None

    class Config:
        from_attributes = True

class DocumentDetailOut(DocumentOut):
    extracted_text: str | None
