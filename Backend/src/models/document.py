from sqlalchemy import String, DateTime, Integer, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from Backend.src.db.base import Base
import uuid
from datetime import datetime

class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="Ready", nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    creator: Mapped["User"] = relationship("User")
