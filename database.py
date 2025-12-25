from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, Enum, ForeignKey, CheckConstraint
from datetime import datetime
import enum

# Create SQLite database (file-based)
SQLALCHEMY_DATABASE_URL = "sqlite:///./employee_management.db"

# Create engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Enums for various status fields
class EmployeeStatus(enum.Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    ON_LEAVE = "On Leave"

class AttendanceStatus(enum.Enum):
    PRESENT = "Present"
    ABSENT = "Absent"
    LATE = "Late"
    HALF_DAY = "Half-day"
    LEAVE = "Leave"

class LeaveStatus(enum.Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"

class LeaveType(enum.Enum):
    SICK = "Sick"
    VACATION = "Vacation"
    PERSONAL = "Personal"
    MATERNITY = "Maternity"
    PATERNITY = "Paternity"
    OTHER = "Other"

class PayrollStatus(enum.Enum):
    PAID = "Paid"
    PENDING = "Pending"
    PROCESSING = "Processing"

class PaymentMethod(enum.Enum):
    BANK_TRANSFER = "Bank Transfer"
    CHECK = "Check"
    CASH = "Cash"

class ReviewStatus(enum.Enum):
    COMPLETED = "Completed"
    PENDING = "Pending"
    CANCELLED = "Cancelled"

# Database session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize database
def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully!")