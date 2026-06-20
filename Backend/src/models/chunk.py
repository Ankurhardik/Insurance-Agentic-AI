from sqlalchemy import Column, String, Integer, Text
from pgvector.sqlalchemy import Vector
from Backend.src.db.base import Base

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    # BAAI/bge-large-en-v1.5 has an embedding dimension of 1024
    embedding = Column(Vector(1024), nullable=False)
