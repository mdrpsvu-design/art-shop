import os
import secrets
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status, Response
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
security = HTTPBasic()

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "art123")

# Порядок категорий для сортировки
CATEGORY_ORDER = ["doll", "weaving", "painting", "scrap", "decoupage", "gifts"]

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
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    connect_args = {}
    engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True, pool_recycle=1800)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Модели БД ---
class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    price = Column(Float)
    category = Column(String)
    images = relationship("ItemImage", back_populates="item", cascade="all, delete-orphan")

class ItemImage(Base):
    __tablename__ = "item_images"
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String)
    item_id = Column(Integer, ForeignKey("items.id"))
    item = relationship("Item", back_populates="images")

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_username(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, ADMIN_USER)
    correct_password = secrets.compare_digest(credentials.password, ADMIN_PASS)
    if not (correct_username and correct_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Error", headers={"WWW-Authenticate": "Basic"})
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

@app.get("/logout")
def logout():
    return Response(
        status_code=status.HTTP_401_UNAUTHORIZED,
        headers={"WWW-Authenticate": "Basic realm='Logout'"}
    )

# --- API ---

@app.get("/api/items")
def get_items(
    category: Optional[str] = None, 
    search: Optional[str] = None, 
    page: int = 1, 
    limit: int = 5, 
    db: Session = Depends(get_db)
):
    query = db.query(Item)
    if category and category != "all":
        query = query.filter(Item.category == category)
    if search:
        query = query.filter(Item.title.ilike(f"%{search}%"))
    
    items = query.all()

    # Сортировка
    def sort_key(item):
        try:
            # Получаем индекс категории
            cat_index = CATEGORY_ORDER.index(item.category)
        except ValueError:
            # Если категории нет в списке, отправляем в конец
            cat_index = 99
        
        # ВАЖНО: Возвращаем кортеж (Категория, ID).
        # Если категории одинаковые, Python будет сравнивать ID.
        # Это гарантирует, что порядок товаров всегда будет одинаковым.
        return (cat_index, item.id)

    # Сортируем, если смотрим "Все" (или если поиск пустой)
    if (not category or category == "all") and not search:
        items.sort(key=sort_key)
    
    # Пагинация
    start_index = (page - 1) * limit
    end_index = start_index + limit
    
    paginated_items = items[start_index:end_index]

    result = []
    for i in paginated_items:
        result.append({
            "id": i.id,
            "title": i.title,
            "description": i.description,
            "price": i.price,
            "category": i.category,
            "images": [img.url for img in i.images]
        })
    
    return result

@app.post("/api/items")
async def create_item(
    title: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    category: str = Form(...),
    files: List[UploadFile] = File(...),
    username: str = Depends(get_current_username),
    db: Session = Depends(get_db)
):
    new_item = Item(title=title, description=description, price=price, category=category)
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    for file in files:
        res = cloudinary.uploader.upload(file.file)
        img_url = res.get("secure_url")
        db_image = ItemImage(url=img_url, item_id=new_item.id)
        db.add(db_image)
    
    db.commit()
    return {"status": "ok", "id": new_item.id}

@app.delete("/api/items/{item_id}")
def delete_item(item_id: int, username: str = Depends(get_current_username), db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}

# Исправленный health check, принимающий и GET, и HEAD запросы
@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "alive"}