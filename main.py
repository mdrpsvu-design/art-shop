import os
import shutil
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Новые импорты
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

# Загружаем переменные окружения (для локальной работы)
load_dotenv()

app = FastAPI()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Подключаем папку статики (теперь только для CSS/JS, не для загрузок)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- Настройка Cloudinary ---
cloudinary.config( 
  cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"), 
  api_key = os.getenv("CLOUDINARY_API_KEY"), 
  api_secret = os.getenv("CLOUDINARY_API_SECRET") 
)

# --- Настройка Базы Данных (PostgreSQL или SQLite) ---
# Если есть переменная DATABASE_URL (на Render), используем её.
# Если нет — создаем локальный файл database.db
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    # Исправление для SQLAlchemy (Render выдает postgres://, а нужно postgresql://)
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./database.db"
    connect_args = {"check_same_thread": False} # Только для SQLite
else:
    connect_args = {} # Для Postgres аргументы не нужны

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    price = Column(Float)
    category = Column(String)
    image_url = Column(String) # Сюда сохраним ссылку на Cloudinary

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Маршруты ---
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/admin", response_class=HTMLResponse)
async def admin_panel(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

# --- API ---
@app.get("/api/items")
def get_items(category: Optional[str] = None, db: Session = Depends(get_db)):
    if category and category != "all":
        return db.query(Item).filter(Item.category == category).all()
    return db.query(Item).all()

@app.post("/api/items")
async def create_item(
    title: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    category: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # !!! МАГИЯ CLOUDINARY !!!
    # Мы не сохраняем файл локально, а отправляем поток байтов сразу в облако
    result = cloudinary.uploader.upload(file.file)
    url = result.get("secure_url") # Получаем вечную ссылку на картинку
    
    item = Item(title=title, description=description, price=price, category=category, image_url=url)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.delete("/api/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}

# --- HEALTH CHECK (Для пинга) ---
@app.get("/health")
def health_check():
    return {"status": "alive"}