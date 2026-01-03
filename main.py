import os
import secrets
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
security = HTTPBasic()

# Настройки админки
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "art123")

# --- База и Cloudinary ---
cloudinary.config( 
  cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"), 
  api_key = os.getenv("CLOUDINARY_API_KEY"), 
  api_secret = os.getenv("CLOUDINARY_API_SECRET") 
)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./database.db"
    connect_args = {"check_same_thread": False}
    # Для SQLite пул не нужен, но движок создаем так же
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    connect_args = {}
    # !!! ВАЖНОЕ ИСПРАВЛЕНИЕ НИЖЕ !!!
    # pool_pre_ping=True проверяет соединение перед использованием
    # pool_recycle=1800 обновляет соединение каждые 30 минут
    engine = create_engine(
        DATABASE_URL, 
        connect_args=connect_args,
        pool_pre_ping=True, 
        pool_recycle=1800
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    price = Column(Float)
    category = Column(String)
    image_url = Column(String)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Авторизация ---
def get_current_username(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, ADMIN_USER)
    correct_password = secrets.compare_digest(credentials.password, ADMIN_PASS)
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- Маршруты ---
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/admin", response_class=HTMLResponse)
async def admin_panel(request: Request, username: str = Depends(get_current_username)):
    return templates.TemplateResponse("admin.html", {"request": request, "username": username})

# --- API ---
@app.get("/api/items")
def get_items(
    category: Optional[str] = None, 
    search: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    query = db.query(Item)
    if category and category != "all":
        query = query.filter(Item.category == category)
    if search:
        query = query.filter(Item.title.ilike(f"%{search}%"))
    return query.all()

@app.post("/api/items")
async def create_item(
    title: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    category: str = Form(...),
    file: UploadFile = File(...),
    username: str = Depends(get_current_username),
    db: Session = Depends(get_db)
):
    # Отправка в Cloudinary
    result = cloudinary.uploader.upload(file.file)
    url = result.get("secure_url")
    
    item = Item(title=title, description=description, price=price, category=category, image_url=url)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.delete("/api/items/{item_id}")
def delete_item(item_id: int, username: str = Depends(get_current_username), db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}

@app.get("/health")
def health_check():
    return {"status": "alive"}