import os
import secrets
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status, Response, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
security = HTTPBasic()

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "art123")

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

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True) # например: "doll"
    name = Column(String) # например: "Куклы"

class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    price = Column(Float)
    category = Column(String) # Здесь храним slug категории
    images = relationship("ItemImage", back_populates="item", cascade="all, delete-orphan")

class ItemImage(Base):
    __tablename__ = "item_images"
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String)
    item_id = Column(Integer, ForeignKey("items.id"))
    item = relationship("Item", back_populates="images")

Base.metadata.create_all(bind=engine)

# --- Pydantic модели для API категорий ---
class CategoryCreate(BaseModel):
    slug: str
    name: str

# --- Инициализация базовых категорий ---
def init_categories():
    db = SessionLocal()
    if db.query(Category).count() == 0:
        initial_cats = [
            {"slug": "doll", "name": "Куклы"},
            {"slug": "weaving", "name": "Ткачество"},
            {"slug": "painting", "name": "Роспись"},
            {"slug": "scrap", "name": "Скрапбукинг"},
            {"slug": "decoupage", "name": "Декупаж"},
            {"slug": "gifts", "name": "Подарки"},
        ]
        for cat in initial_cats:
            db.add(Category(slug=cat['slug'], name=cat['name']))
        db.commit()
        print("Базовые категории добавлены.")
    db.close()

# Запускаем проверку при старте
init_categories()

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

# --- API КАТЕГОРИЙ ---

@app.get("/api/categories")
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@app.post("/api/categories")
def create_category(cat: CategoryCreate, username: str = Depends(get_current_username), db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.slug == cat.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category exists")
    new_cat = Category(slug=cat.slug, name=cat.name)
    db.add(new_cat)
    db.commit()
    return {"status": "ok", "id": new_cat.id}

@app.delete("/api/categories/{cat_id}")
def delete_category(cat_id: int, username: str = Depends(get_current_username), db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Можно добавить проверку: есть ли товары в этой категории, но пока просто удаляем
    db.delete(cat)
    db.commit()
    return {"status": "deleted"}

# --- API ТОВАРОВ ---

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

    # Динамическая сортировка на основе порядка категорий в БД
    # Получаем список всех slug категорий в порядке их ID (или можно добавить поле sort_order в будущем)
    categories_db = db.query(Category).all()
    # Создаем список slug в порядке добавления
    cat_order_list = [c.slug for c in categories_db]

    def sort_key(item):
        try:
            cat_index = cat_order_list.index(item.category)
        except ValueError:
            cat_index = 999 # Если категория удалена, кидаем товар в конец
        return (cat_index, item.id)

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

@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "alive"}